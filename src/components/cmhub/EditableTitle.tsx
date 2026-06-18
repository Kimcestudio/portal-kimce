'use client'
import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

export default function EditableTitle({ value, onChange, placeholder = 'Escribe un título…', className = '' }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select() } }, [editing])

  function commit() {
    const v = draft.trim()
    if (v) { if (v !== value) onChange(v) }
    else setDraft(value)
    setEditing(false)
  }

  function cancel() { setDraft(value); setEditing(false) }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') cancel()
        }}
        onBlur={commit}
        className={`bg-transparent focus:outline-none w-full ${className}`}
        placeholder={placeholder}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-text transition-opacity hover:opacity-70 ${!value ? 'italic text-[#9ca3af]' : ''} ${className}`}
      title="Clic para editar"
    >
      {value || placeholder}
    </span>
  )
}
