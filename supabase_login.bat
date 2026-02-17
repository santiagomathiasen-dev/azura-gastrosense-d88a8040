@echo off
echo ==========================================
echo       LOGIN NO SUPABASE (CLI)
echo ==========================================
echo AVISO: Isso pode levar um momento na primeira vez...
if not exist "node_modules\.bin\supabase.cmd" (
    echo Instalando Supabase CLI localmente...
    call npm install -D supabase
)

echo.
echo 1. O navegador ira abrir na pagina de Tokens do Supabase.
echo 2. Clique em "Generate new token".
echo 3. De um nome e COPIE o token gerado.
echo 4. VOLTE AQUI e cole o token quando solicitado.
echo.
pause
start https://supabase.com/dashboard/account/tokens
echo.
set /p SUPABASE_ACCESS_TOKEN="Cole seu Access Token aqui e de ENTER: "
echo.
echo Logando...
call "node_modules\.bin\supabase.cmd" login --token %SUPABASE_ACCESS_TOKEN%

if %errorlevel% neq 0 (
    echo Falha no login. Verifique o token e tente novamente.
    pause
    exit /b %errorlevel%
)

echo.
echo LOGIN REALIZADO COM SUCESSO!
echo Agora voce pode rodar o 'deploy_pos_api.bat' novamente.
pause
