-- DEV / DEMO ONLY. Preview first; change @Apply to 1 only after reviewing titles.
-- Never change dates of films with existing showtimes, including historical/cancelled ones.
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Apply bit = 0;
DECLARE @Today date = CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()));
DECLARE @Chosen table (movie_id int PRIMARY KEY, new_release date NOT NULL);
BEGIN TRY
    BEGIN TRAN;
    ;WITH candidates AS (
        SELECT TOP (5) m.movie_id
        FROM dbo.movies m WITH (UPDLOCK, HOLDLOCK)
        WHERE m.status = 'COMING_SOON'
          AND (m.release_date IS NULL OR m.release_date <= @Today)
          AND m.duration_minutes BETWEEN 1 AND 840
          AND UPPER(LTRIM(RTRIM(m.age_rating))) IN ('P','K','T13','T16','T18')
          AND NOT EXISTS (SELECT 1 FROM dbo.showtimes st WHERE st.movie_id = m.movie_id)
        ORDER BY m.movie_id
    )
    INSERT INTO @Chosen(movie_id, new_release)
    SELECT movie_id, DATEADD(day, 6 + CONVERT(int, ROW_NUMBER() OVER (ORDER BY movie_id)), @Today)
    FROM candidates;

    SELECT m.movie_id, m.title, m.release_date AS old_release_date,
           c.new_release AS proposed_release_date, m.end_date AS old_end_date,
           CASE WHEN m.end_date < c.new_release THEN DATEADD(day, 30, c.new_release)
                ELSE m.end_date END AS proposed_end_date
    FROM @Chosen c JOIN dbo.movies m ON m.movie_id = c.movie_id
    ORDER BY c.new_release;

    IF @Apply = 1
    BEGIN
        IF (SELECT COUNT(*) FROM @Chosen) < 4
            THROW 51000, N'Không đủ 4 phim sắp chiếu an toàn để đổi ngày. Hãy kiểm tra danh sách phim.', 1;
        UPDATE m
        SET release_date = c.new_release,
            end_date = CASE WHEN m.end_date < c.new_release THEN DATEADD(day, 30, c.new_release) ELSE m.end_date END,
            updated_at = SYSDATETIME()
        FROM dbo.movies m JOIN @Chosen c ON m.movie_id = c.movie_id
        WHERE NOT EXISTS (SELECT 1 FROM dbo.showtimes st WHERE st.movie_id = m.movie_id);
        IF @@ROWCOUNT <> (SELECT COUNT(*) FROM @Chosen)
            THROW 51001, N'Dữ liệu phim đã thay đổi, toàn bộ cập nhật được hoàn tác.', 1;
        COMMIT;
    END
    ELSE ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
