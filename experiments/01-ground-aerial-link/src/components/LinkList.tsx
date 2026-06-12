import type { LinkedAnnotation } from "../lib/types"

interface Props {
  links: LinkedAnnotation[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onRename: (id: string, label: string) => void
  onDelete: (id: string) => void
}

export function LinkList({ links, selectedId, onSelect, onRename, onDelete }: Props) {
  if (links.length === 0) {
    return <p className="hint">No linked objects yet. Use “Link an object” to start.</p>
  }
  return (
    <ul className="link-list">
      {links.map((link) => (
        <li
          key={link.id}
          className={link.id === selectedId ? "selected" : ""}
          onClick={() => onSelect(link.id === selectedId ? null : link.id)}
        >
          <span className="swatch" style={{ background: link.color }} />
          <input
            value={link.label}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRename(link.id, e.target.value)}
          />
          <button
            className="delete"
            title="Delete link"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(link.id)
            }}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
