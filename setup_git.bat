@echo off
set GIT_PATH="C:\Users\Brenda Santi Mike\AppData\Local\GitHubDesktop\app-3.5.4\resources\app\git\cmd\git.exe"

echo Initializing Git repository...
%GIT_PATH% init
if %errorlevel% neq 0 (
    echo Error: Git command failed.
    pause
    exit /b %errorlevel%
)

echo Adding remote...
%GIT_PATH% remote add origin https://github.com/santiagomathiasen-dev/azura-gastrosense-d88a8040.git

echo Renaming branch to main...
%GIT_PATH% branch -M main

echo Adding files...
%GIT_PATH% add .

echo Committing...
%GIT_PATH% commit -m "initial sync"

echo Pushing to GitHub...
%GIT_PATH% push -u origin main

echo Done!
pause
