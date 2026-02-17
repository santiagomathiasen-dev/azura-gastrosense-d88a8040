@echo off
echo Deploying POS Integration API...
echo Usando versao local do Supabase CLI...

if exist "node_modules\.bin\supabase.cmd" (
    call "node_modules\.bin\supabase.cmd" functions deploy pos-integration --no-verify-jwt
) else (
    echo Supabase CLI nao encontrado localmente. Tentando reinstalar...
    call npm install -D supabase
    call "node_modules\.bin\supabase.cmd" functions deploy pos-integration --no-verify-jwt
)

if %errorlevel% neq 0 (
    echo.
    echo ERRO: Talvez voce precise fazer login novamente.
    echo Tente rodar o arquivo 'supabase_login.bat'
    pause
    exit /b %errorlevel%
)

echo.
echo ==========================================
echo       DEPLOY REALIZADO COM SUCESSO!
echo ==========================================
echo.
pause
