function showRenameDialog() {
    if (selectedItems.size !== 1) return;

    const selectedItem = document.querySelector('.file-item.selected, .file-item-grid.selected');
    if (!selectedItem) return;

    const currentName = selectedItem.getAttribute('data-name');
    const isFolder = selectedItem.getAttribute('data-is-folder') === 'true';

    const renameModal = document.getElementById('renameModal');
    const newNameInput = document.getElementById('newName');

    if (!renameModal || !newNameInput) {
        logError('[Rename] Rename modal or input element not found!');
        alert('이름 변경 요소를 찾을 수 없습니다.');
        return;
    }

    newNameInput.value = currentName;
    renameModal.style.display = 'flex';
    newNameInput.focus();

    if (isFolder) {
        newNameInput.select();
        logLog('[Rename] Folder detected, selecting all text.');
    } else {
        const lastDotIndex = currentName.lastIndexOf('.');
        if (lastDotIndex > 0) {
            newNameInput.setSelectionRange(0, lastDotIndex);
            logLog(`[Rename] File with extension detected, selecting name part: ${currentName.substring(0, lastDotIndex)}`);
        } else {
            newNameInput.select();
            logLog('[Rename] File without extension or starting with dot detected, selecting all text.');
        }
    }
}
