function showRenameDialog() {
    if (selectedItems.size !== 1) return;

    const selectedItem = document.querySelector('.file-item.selected');
    if (!selectedItem) return;

    const currentName = selectedItem.getAttribute('data-name');

    const renameModal = document.getElementById('renameModal');
    const newName = document.getElementById('newName');

    if (!renameModal || !newName) {
        console.error('Rename modal or input element not found!');
        alert('이름 변경 요소를 찾을 수 없습니다.');
        return;
    }

    newName.value = currentName;

    renameModal.style.display = 'flex';

    newName.focus();
    const lastDotIndex = currentName.lastIndexOf('.');
    if (lastDotIndex > 0) {
        newName.setSelectionRange(0, lastDotIndex);
    } else {
        newName.select();
    }
}
