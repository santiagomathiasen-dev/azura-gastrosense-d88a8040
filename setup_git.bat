@echo off
set GIT_PATH="C:\Users\Brenda Santi Mike\AppData\Local\GitHubDesktop\app-3.5.4\resources\app\git\cmd\git.exe"

echo Pulling remote changes...
%GIT_PATH% pull origin main --allow-unrelated-histories --no-edit
if %errorlevel% neq 0 (
    echo Merge conflicts detected. Resolving by keeping local version...
    %GIT_PATH% checkout --ours .
    %GIT_PATH% add .
    %GIT_PATH% commit -m "Merge remote and keep local changes"
)

echo Pushing to GitHub...
%GIT_PATH% push -u origin main

echo Done!
pause
