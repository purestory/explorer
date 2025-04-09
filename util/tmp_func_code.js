function clearSelection() {
    document.querySelectorAll('.file-item.selected, .file-item-grid.selected').forEach(item => {
        item.classList.remove('selected');
    });
    selectedItems.clear();
    updateButtonStates();
}
