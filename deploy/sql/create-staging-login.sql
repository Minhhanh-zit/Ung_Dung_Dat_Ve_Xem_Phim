-- CineHunt staging application login.
-- Run only after confirming CineHunt_Test is the isolated staging database.
-- This grants application DML/EXECUTE only inside CineHunt_Test; no db_owner/sysadmin.

USE [master];
GO

IF DB_ID(N'CineHunt_Test') IS NULL
BEGIN
    ;THROW 51000, N'STOP: CineHunt_Test does not exist. Create/verify the staging schema first.', 1;
END;
GO

IF SUSER_ID(N'cinehunt_staging_app') IS NULL
BEGIN
    DECLARE @StagingPassword NVARCHAR(128) = N'REPLACE_WITH_RANDOM_PASSWORD';
    IF @StagingPassword = N'REPLACE_WITH_RANDOM_PASSWORD'
    BEGIN
        ;THROW 51001, N'STOP: Replace the password placeholder with a unique random staging password.', 1;
    END;

    DECLARE @CreateLogin NVARCHAR(MAX) =
        N'CREATE LOGIN [cinehunt_staging_app] WITH PASSWORD = '
        + QUOTENAME(@StagingPassword, '''')
        + N', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;';
    EXEC sys.sp_executesql @CreateLogin;
END;
GO

USE [CineHunt_Test];
GO

IF USER_ID(N'cinehunt_staging_app') IS NULL
BEGIN
    CREATE USER [cinehunt_staging_app] FOR LOGIN [cinehunt_staging_app];
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members rm
    INNER JOIN sys.database_principals role_principal
        ON role_principal.principal_id = rm.role_principal_id
    INNER JOIN sys.database_principals member_principal
        ON member_principal.principal_id = rm.member_principal_id
    WHERE role_principal.name = N'db_datareader'
      AND member_principal.name = N'cinehunt_staging_app'
)
    ALTER ROLE [db_datareader] ADD MEMBER [cinehunt_staging_app];

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members rm
    INNER JOIN sys.database_principals role_principal
        ON role_principal.principal_id = rm.role_principal_id
    INNER JOIN sys.database_principals member_principal
        ON member_principal.principal_id = rm.member_principal_id
    WHERE role_principal.name = N'db_datawriter'
      AND member_principal.name = N'cinehunt_staging_app'
)
    ALTER ROLE [db_datawriter] ADD MEMBER [cinehunt_staging_app];

GRANT EXECUTE TO [cinehunt_staging_app];
GO

PRINT N'CineHunt staging login is ready in CineHunt_Test.';
PRINT N'No db_owner or sysadmin role was granted.';
