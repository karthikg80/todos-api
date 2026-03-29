interface Props {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function BulkToolbar({
  selectedCount,
  totalCount,
  allSelected,
  onSelectAll,
  onComplete,
  onDelete,
  onCancel,
}: Props) {
  return (
    <div id="bulkActionsToolbar" className="bulk-toolbar">
      <input
        id="selectAllCheckbox"
        type="checkbox"
        checked={allSelected}
        onChange={onSelectAll}
        aria-label="Select all"
      />
      <span id="bulkCount" className="bulk-toolbar__count">
        {selectedCount} of {totalCount} selected
      </span>
      <button className="btn" onClick={onComplete}>
        Complete
      </button>
      <button className="btn btn--danger" onClick={onDelete}>
        Delete
      </button>
      <button className="btn" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
