const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
const iconv = require('iconv-lite');

// 앱의 사용자 데이터 폴더에 settings.json 저장
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// 설정 저장 함수
function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        console.log('설정 저장 성공:', settingsPath);
    } catch (error) {
        console.error('설정 저장 실패:', error);
    }
}

// 설정 불러오기 함수
function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            console.log('설정 불러오기 성공:', settingsPath);
            return settings;
        }
        console.log('설정 파일이 존재하지 않습니다. 기본 설정 반환.');
        return null;
    } catch (error) {
        console.error('설정 불러오기 실패:', error);
        return null;
    }
}

// 메인 윈도우 생성 함수
function createWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 550,
        // 앱 아이콘 경로 설정 (패키징 후에도 작동하도록 __dirname 사용)
        icon: path.join(__dirname, 'assets', 'greendaero.ico'),
        resizable: false, // 창 크기 조절 비활성화
        webPreferences: {
            nodeIntegration: true, // Node.js 기능 활성화
            contextIsolation: false, // 컨텍스트 격리 비활성화 (보안상 권장되지는 않지만 예시를 위해)
        },
    });

    win.loadFile('index.html'); // index.html 로드

    // 애플리케이션 메뉴 설정
    const menuTemplate = [
        {
            label: '파일', // 메뉴 라벨
            submenu: [{ role: 'quit', label: '종료' }], // 종료 메뉴 아이템
        },
    ];
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu); // 메뉴 적용
}

// 경로에 공백이 있을 경우 이스케이프 처리 (현재 코드에서는 직접 사용되지 않음)
function escapePath(p) {
    return p.replace(/\s/g, '^ ');
}

// Electron 앱 준비 완료 시 윈도우 생성
app.whenReady().then(createWindow);

// 폴더 선택 다이얼로그 핸들러
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled) return null; // 사용자가 취소한 경우 null 반환
    return result.filePaths[0]; // 선택된 폴더 경로 반환
});

// 스케줄러 등록 핸들러
ipcMain.on('schedule-delete', async (event, folderPath, runTime) => {
    try {
        // 앱의 사용자 데이터 폴더 경로를 사용하여 스크립트 파일 경로 생성
        // 이 경로는 앱이 패키징된 후에도 실제 파일 시스템에 존재합니다.
        const userDataPath = app.getPath('userData');
        const batPath = path.join(userDataPath, 'delete_temp.bat');
        const logPath = path.join(userDataPath, 'delete_log.txt');
        const vbsPath = path.join(userDataPath, 'run_silently.vbs');

        // .bat 파일 내용 정의 (파일 삭제 및 로그 기록)
        const batContent = `@echo off\r\n` +
            `echo 삭제 시작 경로: "${folderPath}" >> "${logPath}"\r\n` +
            `del /f /s /q "${folderPath}\\*.*" >> "${logPath}" 2>&1\r\n` + // 폴더 안의 모든 파일 삭제
            `for /d %%d in ("${folderPath}\\*") do rmdir /s /q "%%d" >> "${logPath}" 2>&1\r\n` + // 모든 하위 폴더 삭제
            `echo %DATE% %TIME% - ${folderPath} 내부 삭제됨 >> "${logPath}"\r\n`;

        fs.writeFileSync(batPath, batContent, 'utf-8'); // .bat 파일 생성

        // .vbs 파일 내용 정의 (숨겨진 상태로 .bat 파일 실행)
        const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\n` +
            `WshShell.Run """${batPath}""", 0, False\n`; // 0: 숨김, False: 대기하지 않음

        fs.writeFileSync(vbsPath, vbsContent, 'utf-8'); // .vbs 파일 생성

        const taskName = 'GreendaeroFolderCleaner'; // 스케줄러 작업 이름

        // schtasks 명령어를 사용하여 스케줄러 등록
        // /tr: 실행할 프로그램 경로 (여기서는 vbs 스크립트)
        // /sc daily: 매일 실행
        // /st: 시작 시간 (HH:mm 형식)
        // /rl highest: 최고 권한으로 실행
        const cmd = `schtasks /create /f /tn "${taskName}" /tr "wscript.exe \\"${vbsPath}\\"" /sc daily /st ${runTime} /rl highest`;

        // 명령 실행 및 결과 처리
        child_process.exec(cmd, { encoding: 'buffer' }, (error, stdout, stderr) => {
            // Windows 명령어 출력은 cp949 인코딩을 사용
            const outStr = iconv.decode(stdout, 'cp949');
            const errStr = iconv.decode(stderr, 'cp949'); // <-- 'cp4949' -> 'cp949' 수정

            if (error) {
                console.error('스케줄러 등록 실패:', errStr);
                // 실제 앱에서는 사용자에게 오류 메시지를 표시하는 로직 추가
            } else {
                console.log('스케줄러 등록 성공:', outStr);
                // 실제 앱에서는 사용자에게 성공 메시지를 표시하는 로직 추가
            }
        });
    } catch (err) {
        console.error('스케줄 등록 중 오류 발생:', err);
    }
});

// 스케줄러 삭제 핸들러
ipcMain.on('schedule-delete-remove', () => {
    const taskName = 'GreendaeroFolderCleaner'; // 삭제할 스케줄러 작업 이름
    const cmd = `schtasks /delete /tn "${taskName}" /f`; // /f: 강제 삭제

    // 명령 실행 및 결과 처리
    child_process.exec(cmd, { encoding: 'buffer' }, (error, stdout, stderr) => {
        const outStr = iconv.decode(stdout, 'cp949');
        const errStr = iconv.decode(stderr, 'cp949'); // <-- 'cp4949' -> 'cp949' 수정

        if (error) {
            console.error('스케줄러 삭제 실패:', errStr);
        } else {
            console.log('스케줄러 삭제 성공:', outStr);
        }
    });
});

// 설정 불러오기 핸들러 (렌더러 프로세스에서 호출)
ipcMain.handle('load-settings', () => {
    // 설정이 없으면 기본값 반환
    return loadSettings() || { folderPath: null, intervalMinutes: 60 };
});

// 설정 저장 핸들러 (렌더러 프로세스에서 호출)
ipcMain.on('save-settings', (event, settings) => {
    saveSettings(settings);
});
