const { ipcRenderer } = require('electron');

let selectedFolder = null; // 초기에는 null로 설정

// 폴더 선택 버튼 클릭
document.getElementById('selectBtn').addEventListener('click', async () => {
    selectedFolder = await ipcRenderer.invoke('select-folder');
    if (selectedFolder) {
        document.getElementById('folderPath').textContent = "선택된 폴더: " + selectedFolder;
        document.getElementById('timeInput').focus();
    }
});

// 저장된 설정 불러오기 (초기 로드)
window.onload = async () => {
    const settings = await ipcRenderer.invoke('load-settings');
    if (settings.folderPath) {
        selectedFolder = settings.folderPath;
        document.getElementById('folderPath').textContent = "선택된 폴더: " + selectedFolder;
    }
    if (settings.runTime) {
        document.getElementById('timeInput').value = settings.runTime;
    }
};

// 삭제 작업 등록 버튼 클릭
document.getElementById('registerBtn').addEventListener('click', () => {
    const runTime = document.getElementById('timeInput').value;

    // selectedFolder 변수 대신, 현재 화면에 표시된 폴더 경로를 사용합니다.
    const currentFolderPath = document.getElementById('folderPath').textContent.replace('선택된 폴더: ', '');

    if(selectedFolder === "없음") {
        alert("폴더를 선택해주세요!");
        return;
    }

    if (!currentFolderPath || currentFolderPath === '폴더가 선택되지 않았습니다.') {
        alert("폴더를 선택해주세요!");
        return;
    }
    if (!runTime) {
        alert("실행 시간을 입력해주세요!");
        return;
    }

    // IPC 통신 시 currentFolderPath를 전달합니다.
    ipcRenderer.send('schedule-delete', currentFolderPath, runTime);
    ipcRenderer.send('save-settings', { folderPath: currentFolderPath, runTime });
    alert("삭제 작업이 등록되었습니다!");
});

// 삭제 작업 제거 버튼 클릭
document.getElementById('removeBtn').addEventListener('click', () => {
    ipcRenderer.send('schedule-delete-remove');
    alert("삭제 작업이 제거되었습니다!");
});