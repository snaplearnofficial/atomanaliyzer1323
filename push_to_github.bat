@echo off
echo =========================================
echo Pushing Atom Analyzer Pro to GitHub...
echo =========================================

:: 1. Add all changed files to git staging
git add .

:: 2. Commit the changes
git commit -m "feat: implement 3D XRD, Energy Minimizer, and production MongoDB support"

echo.
echo Pushing code to GitHub remote...

:: 3. Try pushing to main branch
git push origin main
if %ERRORLEVEL% neq 0 (
    echo.
    echo Main branch push failed or branch not found.
    echo Trying master branch instead...
    git push origin master
)

echo.
echo =========================================
echo Done! Your code is updated on GitHub.
echo =========================================
pause
