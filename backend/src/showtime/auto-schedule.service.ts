import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import { Showtime } from '../entities/showtime.entity';
import { CORE_CINEMAS, localDay, parseConfig, planSchedule, isEligible, type ScheduleConfig, type MovieRow, type RoomRow, type ExistingRow } from './auto-schedule-plan';

@Injectable()
export class AutoScheduleService {
  constructor(private readonly dataSource: DataSource) {}

  private async inventory(manager: EntityManager) {
    const movies = await manager.query(`SELECT movie_id AS movieId,title,duration_minutes AS duration,status,
      CONVERT(char(10),release_date,23) AS releaseDate, CONVERT(char(10),end_date,23) AS endDate,age_rating AS ageRating
      FROM dbo.movies WHERE status IN ('NOW_SHOWING','COMING_SOON') ORDER BY movie_id`) as MovieRow[];
    const rooms = await manager.query(`SELECT r.room_id AS roomId,r.room_name AS roomName,c.cinema_name AS cinemaName,
      COUNT(s.seat_id) AS seats, SUM(CASE WHEN s.status='ACTIVE' THEN 1 ELSE 0 END) AS activeSeats
      FROM dbo.rooms r JOIN dbo.cinemas c ON c.cinema_id=r.cinema_id
      LEFT JOIN dbo.seats s ON s.room_id=r.room_id
      WHERE r.status='ACTIVE' AND c.status='ACTIVE' AND c.cinema_name IN (@0,@1,@2)
      GROUP BY r.room_id,r.room_name,c.cinema_name ORDER BY r.room_id`, [...CORE_CINEMAS]) as RoomRow[];
    return {movies,rooms};
  }

  async options() {
    const {movies,rooms}=await this.inventory(this.dataSource.manager);
    const today=localDay(Date.now());
    return {today,cinemas:[...CORE_CINEMAS].map(name=>({name,rooms:rooms.filter(r=>r.cinemaName===name&&r.activeSeats>0).length})),
      earlyMovies:movies.filter(m=>m.status==='COMING_SOON').map(m=>({...m,eligible:isEligible(m),reason:!isEligible(m)?'Thiếu phân loại độ tuổi hoặc thời lượng/ngày không hợp lệ':!m.releaseDate?'Chưa có ngày khởi chiếu':m.releaseDate<=today?'Ngày khởi chiếu đã qua hoặc là hôm nay':null})),
      regularMovies:movies.filter(m=>m.status==='NOW_SHOWING'&&isEligible(m))};
  }

  private async build(manager:EntityManager,config:ScheduleConfig,now:number,inventory:Awaited<ReturnType<AutoScheduleService['inventory']>>) {
    const rooms=inventory.rooms.filter(r=>config.cinemaNames.includes(r.cinemaName)&&r.activeSeats>0);
    const start=new Date(Date.parse(config.startDate+'T00:00:00+07:00')-config.gapMinutes*60_000);
    const end=new Date(Date.parse(config.startDate+'T00:00:00+07:00')+config.days*86400000+config.gapMinutes*60_000);
    const existing = await manager.query(`SELECT st.room_id AS roomId,st.movie_id AS movieId,st.start_time AS startTime,st.end_time AS endTime,st.status
      FROM dbo.showtimes st JOIN dbo.rooms r ON r.room_id=st.room_id JOIN dbo.cinemas c ON c.cinema_id=r.cinema_id
      WHERE c.cinema_name IN (@0,@1,@2) AND st.status<>'CANCELLED' AND st.start_time<@3 AND st.end_time>@4`,[...CORE_CINEMAS,end,start]) as Array<Omit<ExistingRow,'startTime'|'endTime'>&{startTime:Date;endTime:Date}>;
    let plan:ReturnType<typeof planSchedule>;
    try {plan=planSchedule(config,inventory.movies,rooms,existing.map(s=>({...s,startTime:new Date(s.startTime).toISOString(),endTime:new Date(s.endTime).toISOString()})),now);}
    catch(e){throw new BadRequestException(e instanceof Error?e.message:'Không lập được lịch');}
    const digest=createHash('sha256').update(JSON.stringify({config,rows:plan.rows,warnings:plan.warnings})).digest('hex');
    return {...plan,digest};
  }

  private config(raw:unknown,now:number){try{return parseConfig(raw,now);}catch(e){throw new BadRequestException(e instanceof Error?e.message:'Cấu hình không hợp lệ');}}
  async preview(raw:unknown){const now=Date.now(),config=this.config(raw,now);return this.build(this.dataSource.manager,config,now,await this.inventory(this.dataSource.manager));}

  async apply(raw:unknown,digest:unknown,userId:number){
    if(typeof digest!=='string'||!/^\w{64}$/.test(digest))throw new BadRequestException('Cần mã xem trước hợp lệ');
    const config=this.config(raw,Date.now());
    return this.dataSource.transaction(async manager=>{
      // Global lock prevents two bulk generators from interleaving; room locks match manual CRUD.
      const lock=async(resource:string)=>{const rows=await manager.query(`DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=@0,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; SELECT @r AS result`,[resource]) as Array<{result:number}>;if(Number(rows[0]?.result??-999)<0)throw new ConflictException('Lịch đang được cập nhật; hãy xem trước lại');};
      await lock('CineHunt.AutoSchedule');
      const before=await this.inventory(manager);
      const ids=before.rooms.filter(r=>config.cinemaNames.includes(r.cinemaName)&&r.activeSeats>0).map(r=>r.roomId).sort((a,b)=>a-b);
      for(const id of ids)await lock(`CineHunt.ShowtimeRoom.${id}`);
      const inventory=await this.inventory(manager);
      const afterIds=inventory.rooms.filter(r=>config.cinemaNames.includes(r.cinemaName)&&r.activeSeats>0).map(r=>r.roomId).sort((a,b)=>a-b);
      if(JSON.stringify(ids)!==JSON.stringify(afterIds))throw new ConflictException('Danh sách phòng đã thay đổi; hãy xem trước lại');
      const plan=await this.build(manager,config,Date.now(),inventory);
      if(plan.digest!==digest)throw new ConflictException('Lịch hoặc dữ liệu đã thay đổi; hãy xem trước lại');
      if(!plan.rows.length)return {created:0,seatCount:0,early:0};
      let seatCount=0;
      // Same seat pricing/status rules as ShowtimeService.seedSeatsForShowtime; set-based insert for bulk performance.
      for(const row of plan.rows){
        const saved=await manager.save(Showtime,manager.create(Showtime,{movieId:row.movieId,roomId:row.roomId,startTime:new Date(row.startTime),endTime:new Date(row.endTime),basePrice:row.basePrice,status:'OPEN',createdBy:userId}));
        const result=await manager.query(`INSERT INTO dbo.showtime_seats(showtime_id,seat_id,price,status,held_by_user_id,hold_expires_at)
          SELECT @0,s.seat_id,CASE t.type_code WHEN 'CH_STANDARD' THEN @1 WHEN 'CH_VIP' THEN @1+5000 WHEN 'CH_COUPLE' THEN @1+20000 ELSE ROUND(@1*COALESCE(t.price_multiplier,1),0) END /* CINEHUNT_FIXED_SEAT_PRICE */,CASE WHEN s.status='ACTIVE' THEN 'AVAILABLE' ELSE 'BLOCKED' END,NULL,NULL
          FROM dbo.seats s LEFT JOIN dbo.seat_types t ON t.seat_type_id=s.seat_type_id WHERE s.room_id=@2
          AND NOT EXISTS(SELECT 1 FROM dbo.showtime_seats ss WHERE ss.showtime_id=@0 AND ss.seat_id=s.seat_id);
          SELECT COUNT(*) AS total,SUM(CASE WHEN status='AVAILABLE' THEN 1 ELSE 0 END) AS available FROM dbo.showtime_seats WHERE showtime_id=@0`,[saved.showtimeId,row.basePrice,row.roomId]) as Array<{total:number;available:number}>;
        if(Number(result[0]?.total)!==row.seats||Number(result[0]?.available??0)<1)throw new ConflictException('Sơ đồ ghế đã thay đổi; toàn bộ lượt tạo được hoàn tác');
        seatCount+=Number(result[0].total);
      }
      return {created:plan.rows.length,seatCount,early:plan.early};
    });
  }
}
