@echo off
echo Deploying Loyverse Webhook Function...
echo Usando versao local do Supabase CLI...

if exist "node_modules\.bin\supabase.cmd" (
    call "node_modules\.bin\supabase.cmd" functions deploy loyverse-webhook --no-verify-jwt
) else (
    echo Supabase CLI nao encontrado localmente. Tentando reinstalar...
    call npm install -D supabase
    call "node_modules\.bin\supabase.cmd" functions deploy loyverse-webhook --no-verify-jwt
)

if %errorlevel% neq 0 (
    echo.
    echo ERRO: Falha no deploy.
    echo Tente rodar o arquivo 'supabase_login.bat' novamente se for erro de permissao.
    pause
    exit /b %errorlevel%
)

echo.
echo ==========================================
echo       WEBHOOK DEPLOYADO COM SUCESSO!
echo ==========================================
echo.
pause
