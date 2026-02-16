@echo off
setlocal
echo ===================================================
echo   Configuração do WhatsApp - Azura GastroSense
echo ===================================================
echo.

echo.
echo --- INSTRUÇÕES ---
echo 1. Acesse https://developers.facebook.com/apps/
echo 2. Selecione seu App e vá em WhatsApp > API Setup
echo.

set /p PHONE_ID="Cole o 'Phone Number ID': "
set /p ACCESS_TOKEN="Cole o 'Temporary Access Token' (ou Token Permanente): "
echo.
echo Crie uma senha de verificação para o Webhook (ex: azura_secret_123)
set /p VERIFY_TOKEN="Digite o Verify Token: "

echo.
echo [1/3] Configurando segredos no Supabase...
call npx supabase secrets set WHATSAPP_PHONE_NUMBER_ID=%PHONE_ID%
call npx supabase secrets set WHATSAPP_ACCESS_TOKEN=%ACCESS_TOKEN%
call npx supabase secrets set WHATSAPP_VERIFY_TOKEN=%VERIFY_TOKEN%

echo.
echo [2/3] Fazendo deploy da função de envio (send-whatsapp)...
call npx supabase functions deploy send-whatsapp --no-verify-jwt

echo.
echo [3/3] Fazendo deploy do webhook (whatsapp-webhook)...
call npx supabase functions deploy whatsapp-webhook --no-verify-jwt

echo.
echo ===================================================
echo   Configuração Concluída!
echo ===================================================
echo.
echo Agora vá no Painel do Facebook > WhatsApp > Configuration
echo Edite o Webhook e coloque a URL da sua função e o Verify Token: %VERIFY_TOKEN%
echo.
pause
