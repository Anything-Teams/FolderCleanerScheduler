@echo off
echo 삭제 시작 경로: "C:\Users\user\Downloads\test" >> "C:\work\folderDelete\delete_log.txt"
del /f /q "C:\Users\user\Downloads\test\*.*" >> "C:\work\folderDelete\delete_log.txt" 2>&1
echo %DATE% %TIME% - C:\Users\user\Downloads\test 파일 삭제됨 >> "C:\work\folderDelete\delete_log.txt"
