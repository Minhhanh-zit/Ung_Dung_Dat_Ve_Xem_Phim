'use strict';
/**
 * DEV ONLY. Create/update ONLY CineHunt Thanh Xuân, at the documented location
 * of Beta Thanh Xuân (B1 Golden West, 2 Lê Văn Thiêm, Hà Nội).
 * No other cinema/booking/showtime/payment/ticket is changed.
 * Default is read-only preview. Apply requires two explicit flags.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
require('dotenv').config({path: path.resolve(__dirname, '../.env')});
const sql = require('mssql');
const NAME = 'CineHunt Thanh Xuân';
const ADDRESS = 'Tầng hầm B1, tòa Golden West, số 2 Lê Văn Thiêm';
// Coordinates approximate the Golden West building, not an independently verified entrance.
const LAT = 21.00220;
const LON = 105.80277;
const apply = process.argv.includes('--apply');
const approved = process.argv.includes('--i-understand-dev-db');
const db = String(process.env.DB_DATABASE || '');
if (!/cinehunt/i.test(db) || process.env.NODE_ENV === 'production') {
  console.error('STOP: Only non-production CineHunt databases allowed');
  process.exit(2);
}
if (apply && !approved) {console.error('STOP: Missing --i-understand-dev-db');process.exit(2);}
if (!process.env.DB_USERNAME || !process.env.DB_PASSWORD) {console.error('STOP: Missing DB credentials in backend/.env');process.exit(2);}
const cfg = {server:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||14332),
  user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:db,
  options:{encrypt:process.env.DB_ENCRYPT==='true',trustServerCertificate:true},
  connectionTimeout:12000,requestTimeout:30000};
async function getCinema(request) {
  return (await request.input('name',sql.NVarChar(180),NAME).query(`
    SELECT cinema_id AS id,cinema_name AS name,address,city,district,latitude,longitude,status
    FROM dbo.cinemas WHERE cinema_name=@name`)).recordset;
}
async function main() {
  const pool=await sql.connect(cfg);
  try {
    const existing=await getCinema(new sql.Request(pool));
    if(existing.length>1)throw new Error('Duplicated CineHunt Thanh Xuân rows; stop.');
    console.log('DATABASE='+db);
    console.log('TARGET='+NAME);
    console.log('ADDRESS='+ADDRESS+', Phường Thanh Xuân, Hà Nội');
    console.log('COORDS_APPROX='+LAT+','+LON);
    console.table(existing);
    if(!apply){console.log('RESULT=DRY_RUN_ONLY');return;}
    const snapshotDir=path.join(os.homedir(),'Projects');fs.mkdirSync(snapshotDir,{recursive:true});
    const snapshot=path.join(snapshotDir,'Cinehunt-ThanhXuan-before-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
    fs.writeFileSync(snapshot,JSON.stringify({database:db,existing},null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('STATUS_SNAPSHOT='+snapshot);
    const tx=new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const lock=await new sql.Request(tx).query(`DECLARE @r INT;
        EXEC @r=sys.sp_getapplock @Resource='CineHunt.ConfigureThreeCinemas',
          @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
        SELECT @r AS result;`);
      if(Number(lock.recordset[0]?.result??-999)<0)throw new Error('Cannot acquire cinema configuration lock');
      const again=await getCinema(new sql.Request(tx));
      if(again.length>1)throw new Error('Duplicated cinema; rollback');
      if(!again.length) {
        await new sql.Request(tx)
          .input('name',sql.NVarChar(180),NAME)
          .input('address',sql.NVarChar(300),ADDRESS)
          .input('lat',sql.Decimal(10,7),LAT)
          .input('lon',sql.Decimal(10,7),LON)
          .query(`INSERT INTO dbo.cinemas(cinema_name,address,city,district,latitude,longitude,status)
            VALUES(@name,@address,N'Hà Nội',N'Thanh Xuân',@lat,@lon,'ACTIVE')`);
      } else {
        await new sql.Request(tx)
          .input('name',sql.NVarChar(180),NAME)
          .input('address',sql.NVarChar(300),ADDRESS)
          .input('lat',sql.Decimal(10,7),LAT)
          .input('lon',sql.Decimal(10,7),LON)
          .query(`UPDATE dbo.cinemas SET address=@address,city=N'Hà Nội',district=N'Thanh Xuân',
             latitude=@lat,longitude=@lon,status='ACTIVE',updated_at=SYSDATETIME()
             WHERE cinema_name=@name`);
      }
      const c=await getCinema(new sql.Request(tx));
      if(c.length!==1 || c[0].status!=='ACTIVE')throw new Error('Postcondition failed');
      const cinemaId=c[0].id;
      const rooms=(await new sql.Request(tx).input('id',sql.Int,cinemaId)
        .query('SELECT room_id FROM dbo.rooms WHERE cinema_id=@id')).recordset;
      if(!rooms.length){
        const types=(await new sql.Request(tx).query(`SELECT TOP (1) seat_type_id AS id
          FROM dbo.seat_types WHERE status='ACTIVE'
          ORDER BY CASE WHEN type_code='NORMAL' THEN 0 ELSE 1 END,seat_type_id`)).recordset;
        if(!types.length)throw new Error('Missing active seat type. Roll back; no fake seats.');
        await new sql.Request(tx).input('id',sql.Int,cinemaId).query(`INSERT INTO dbo.rooms
          (cinema_id,room_name,room_type,total_seats,status) VALUES(@id,N'Phòng 1','STANDARD',80,'ACTIVE')`);
        const room=(await new sql.Request(tx).input('id',sql.Int,cinemaId)
          .query("SELECT TOP (1) room_id AS id FROM dbo.rooms WHERE cinema_id=@id AND room_name=N'Phòng 1' ORDER BY room_id DESC")).recordset[0];
        if(!room)throw new Error('Cannot find the new room; rollback');
        await new sql.Request(tx).input('room',sql.Int,room.id).input('type',sql.Int,types[0].id)
          .query(`WITH R AS (
            SELECT row_name FROM (VALUES ('A'),('B'),('C'),('D'),('E'),('F'),('G'),('H')) v(row_name)
          ), N AS (
            SELECT number FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10)) v(number)
          )
          INSERT INTO dbo.seats(room_id,seat_type_id,seat_row,seat_number,seat_label,status)
          SELECT @room,@type,R.row_name,N.number,CONCAT(R.row_name,N.number),'ACTIVE'
          FROM R CROSS JOIN N`);
      }
      await tx.commit();
      console.log('CINEMA_ID='+cinemaId);
      console.log('RESULT=APPLIED');
      console.log('NOTE=Other cinemas, old bookings and paid tickets were NOT touched.');
    }catch(e){await tx.rollback();throw e;}
  }finally{await pool.close();}
}
main().catch(e=>{console.error('ERROR='+e.message);process.exitCode=1;});
