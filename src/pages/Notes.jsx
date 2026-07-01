import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'

import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'

import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

// Helper per mostrare titolo, anteprima e date delle note.
function formatNoteDate(timestamp) {
  if (!timestamp?.toDate) return 'Non ancora salvata'

  return timestamp.toDate().toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPreviewText(note) {
  if (note?.plainText?.trim()) {
    return note.plainText.trim()
  }

  return 'Nessun contenuto'
}

function getTitle(note) {
  if (note?.title?.trim()) {
    return note.title.trim()
  }

  return 'Nota senza titolo'
}

function getSafeContent(content) {
  if (typeof content !== 'string') return '<p></p>'
  if (!content.trim()) return '<p></p>'

  return content
}

function Notes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hasCreatedFromUrlRef = useRef(false)

  const userId = user?.uid || ''

  const [notes, setNotes] = useState([])
  const [selectedNoteId, setSelectedNoteId] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [title, setTitle] = useState('')
  const [contentHtml, setContentHtml] = useState('<p></p>')
  const [plainText, setPlainText] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isLoadingNotes, setIsLoadingNotes] = useState(true)

  // Editor rich text TipTap: salva HTML e testo semplice a ogni modifica.
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'notes-v4-rich-editor',
      },
    },
    onUpdate({ editor }) {
      setContentHtml(editor.getHTML())
      setPlainText(editor.getText())
    },
  })

  // Crea una nota vuota e la seleziona subito nell'editor.
  const handleCreateNote = useCallback(async () => {
    if (!userId) {
      setError('Utente non trovato. Ricarica la pagina e riprova.')
      setMessage('')
      return null
    }

    setError('')
    setMessage('')

    try {
      const notesRef = collection(db, 'users', userId, 'notes')

      const newNote = await addDoc(notesRef, {
        title: 'Nuova nota',
        content: '<p></p>',
        plainText: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setSelectedNoteId(newNote.id)
      setTitle('Nuova nota')
      setContentHtml('<p></p>')
      setPlainText('')

      if (editor) {
        editor.commands.setContent('<p></p>')
      }

      setMessage('Nuova nota creata.')
      return newNote.id
    } catch (createError) {
      console.error(createError)
      setError('Errore durante la creazione della nota.')
      setMessage('')
      return null
    }
  }, [userId, editor])

  // Carica e mantiene aggiornato l'elenco note dell'utente.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!userId) {
      setIsLoadingNotes(false)
      return
    }

    setIsLoadingNotes(true)

    const notesRef = collection(db, 'users', userId, 'notes')
    const notesQuery = query(notesRef, orderBy('updatedAt', 'desc'))

    const unsubscribe = onSnapshot(
      notesQuery,
      (snapshot) => {
        const notesData = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }))

        setNotes(notesData)

        setSelectedNoteId((currentSelectedNoteId) => {
          if (notesData.length === 0) return null

          const selectedStillExists = notesData.some(
            (note) => note.id === currentSelectedNoteId
          )

          if (selectedStillExists) return currentSelectedNoteId

          return notesData[0].id
        })

        setIsLoadingNotes(false)
      },
      (snapshotError) => {
        console.error(snapshotError)
        setError('Errore durante il caricamento delle note.')
        setIsLoadingNotes(false)
      }
    )

    return () => unsubscribe()
  }, [userId])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Supporta il link /notes?new=true usato dalle scorciatoie.
  useEffect(() => {
    if (!userId) return

    const shouldCreateNewNote = searchParams.get('new') === 'true'

    if (!shouldCreateNewNote) return
    if (hasCreatedFromUrlRef.current) return

    hasCreatedFromUrlRef.current = true

    async function createFromUrl() {
      await handleCreateNote()
      navigate('/notes', { replace: true })
    }

    createFromUrl()
  }, [userId, searchParams, handleCreateNote, navigate])

  // Ricerca locale tra titolo e testo senza interrogare Firestore.
  const filteredNotes = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()

    if (!normalizedSearch) return notes

    return notes.filter((note) => {
      const noteTitle = note.title?.toLowerCase() || ''
      const noteText = note.plainText?.toLowerCase() || ''

      return (
        noteTitle.includes(normalizedSearch) ||
        noteText.includes(normalizedSearch)
      )
    })
  }, [notes, searchText])

  const selectedNote = useMemo(() => {
    return notes.find((note) => note.id === selectedNoteId) || null
  }, [notes, selectedNoteId])

  // Sincronizza la nota selezionata con titolo, contenuto e editor TipTap.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!editor) return

    if (!selectedNote) {
      setTitle('')
      setContentHtml('<p></p>')
      setPlainText('')

      try {
        editor.commands.setContent('<p></p>')
      } catch (editorError) {
        console.error(editorError)
      }

      return
    }

    const nextTitle = selectedNote.title || ''
    const nextContent = getSafeContent(selectedNote.content)
    const nextPlainText = selectedNote.plainText || ''

    setTitle(nextTitle)
    setContentHtml(nextContent)
    setPlainText(nextPlainText)

    try {
      if (editor.getHTML() !== nextContent) {
        editor.commands.setContent(nextContent)
      }
    } catch (editorError) {
      console.error(editorError)
      editor.commands.setContent('<p></p>')
      setContentHtml('<p></p>')
      setPlainText('')
      setError('La nota aveva un contenuto non valido. Ho aperto un foglio vuoto.')
    }
  }, [selectedNote, editor])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Salva titolo, HTML e testo semplice della nota corrente.
  async function handleSaveNote() {
    if (!userId) {
      setError('Utente non trovato. Ricarica la pagina e riprova.')
      setMessage('')
      return
    }

    if (!selectedNoteId) {
      setError('Crea prima una nota.')
      setMessage('')
      return
    }

    if (!title.trim() && !plainText.trim()) {
      setError('Scrivi almeno un titolo o un contenuto.')
      setMessage('')
      return
    }

    setError('')
    setMessage('')

    try {
      const noteRef = doc(db, 'users', userId, 'notes', selectedNoteId)

      await updateDoc(noteRef, {
        title: title.trim(),
        content: contentHtml || '<p></p>',
        plainText: plainText.trim(),
        updatedAt: serverTimestamp(),
      })

      setMessage('Nota salvata.')
    } catch (saveError) {
      console.error(saveError)
      setError('Errore durante il salvataggio della nota.')
      setMessage('')
    }
  }

  // Eliminazione protetta da modale di conferma.
  function openDeleteModal() {
    if (!selectedNoteId) return
    setIsDeleteModalOpen(true)
  }

  function closeDeleteModal() {
    setIsDeleteModalOpen(false)
  }

  async function handleDeleteNote() {
    if (!userId) {
      setError('Utente non trovato. Ricarica la pagina e riprova.')
      setMessage('')
      return
    }

    if (!selectedNoteId) return

    setError('')
    setMessage('')

    try {
      const noteRef = doc(db, 'users', userId, 'notes', selectedNoteId)

      await deleteDoc(noteRef)

      const remainingNotes = notes.filter((note) => note.id !== selectedNoteId)

      setSelectedNoteId(remainingNotes[0]?.id || null)
      setMessage('Nota eliminata.')
      setIsDeleteModalOpen(false)
    } catch (deleteError) {
      console.error(deleteError)
      setError('Errore durante l’eliminazione della nota.')
      setMessage('')
    }
  }

  // Comandi toolbar e modalita fullscreen dell'editor.
  function selectNote(noteId) {
    setSelectedNoteId(noteId)
    setMessage('')
    setError('')
  }

  function toggleFullscreen() {
    setIsFullscreen((currentValue) => !currentValue)
  }

  function runEditorCommand(command) {
    if (!editor) return

    try {
      command()
    } catch (commandError) {
      console.error(commandError)
      setError('Errore durante l’uso dell’editor.')
    }
  }

  function toolbarClass(isActive) {
    return isActive
      ? 'notes-v4-toolbar-button active'
      : 'notes-v4-toolbar-button'
  }

  return (
    <main
      className={
        isFullscreen
          ? 'dashboard-page notes-v4-page notes-v4-fullscreen'
          : 'dashboard-page notes-v4-page'
      }
    >
      <section className="notes-v4-shell">
        <aside className="notes-v4-sidebar">
          <div className="notes-v4-sidebar-top">
            <div>
              <span className="notes-v4-kicker">Planify Notes</span>
              <h1>Note</h1>
            </div>

            <button
              type="button"
              className="notes-v4-create-button"
              onClick={handleCreateNote}
              title="Nuova nota"
              disabled={!userId}
            >
              +
            </button>
          </div>

          <div className="notes-v4-search">
            <input
              type="search"
              placeholder="Cerca nelle note..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          <div className="notes-v4-sidebar-list">
            {isLoadingNotes ? (
              <div className="notes-v4-empty-sidebar">
                <strong>Caricamento note...</strong>
                <p>Sto preparando il tuo spazio di scrittura.</p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="notes-v4-empty-sidebar">
                <strong>Nessuna nota</strong>
                <p>Crea una nuova nota con il pulsante +.</p>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <button
                  type="button"
                  key={note.id}
                  className={
                    note.id === selectedNoteId
                      ? 'notes-v4-sidebar-item active'
                      : 'notes-v4-sidebar-item'
                  }
                  onClick={() => selectNote(note.id)}
                >
                  <strong>{getTitle(note)}</strong>
                  <span>{getPreviewText(note)}</span>
                  <small>{formatNoteDate(note.updatedAt)}</small>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="notes-v4-workspace">
          <header className="notes-v4-topbar">
            <div className="notes-v4-nav">
              <Link to="/dashboard" className="btn btn-secondary">
                Dashboard
              </Link>

              <Link to="/calendar" className="btn btn-secondary">
                Calendario
              </Link>
            </div>

            <div className="notes-v4-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? 'Riduci' : 'Schermo intero'}
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={openDeleteModal}
                disabled={!selectedNoteId}
              >
                Elimina
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveNote}
                disabled={!selectedNoteId}
              >
                Salva
              </button>
            </div>
          </header>

          {message && (
            <p className="notes-v4-feedback success-feedback">{message}</p>
          )}

          {error && <p className="notes-v4-feedback error-feedback">{error}</p>}

          {!editor ? (
            <div className="notes-v4-empty-document">
              <h2>Editor in caricamento</h2>
              <p>Sto preparando l’area di scrittura.</p>
            </div>
          ) : selectedNote ? (
            <article className="notes-v4-document-area">
              <input
                className="notes-v4-title-input"
                type="text"
                placeholder="Titolo nota"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />

              <div className="notes-v4-toolbar">
                <div className="notes-v4-toolbar-group">
                  <button
                    type="button"
                    className={toolbarClass(editor.isActive('bold'))}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().toggleBold().run()
                      )
                    }
                    title="Grassetto"
                  >
                    <strong>B</strong>
                    <span>Grassetto</span>
                  </button>

                  <button
                    type="button"
                    className={toolbarClass(editor.isActive('italic'))}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().toggleItalic().run()
                      )
                    }
                    title="Corsivo"
                  >
                    <em>I</em>
                    <span>Corsivo</span>
                  </button>

                  <button
                    type="button"
                    className={toolbarClass(editor.isActive('underline'))}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().toggleUnderline().run()
                      )
                    }
                    title="Sottolineato"
                  >
                    <u>U</u>
                    <span>Sottolinea</span>
                  </button>
                </div>

                <div className="notes-v4-toolbar-group">
                  <button
                    type="button"
                    className={toolbarClass(editor.isActive('paragraph'))}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().setParagraph().run()
                      )
                    }
                    title="Testo normale"
                  >
                    Aa
                    <span>Testo</span>
                  </button>

                  <button
                    type="button"
                    className={toolbarClass(
                      editor.isActive('heading', { level: 2 })
                    )}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().toggleHeading({ level: 2 }).run()
                      )
                    }
                    title="Titolo"
                  >
                    T
                    <span>Titolo</span>
                  </button>

                  <button
                    type="button"
                    className={toolbarClass(
                      editor.isActive('heading', { level: 3 })
                    )}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().toggleHeading({ level: 3 }).run()
                      )
                    }
                    title="Sottotitolo"
                  >
                    S
                    <span>Sottotitolo</span>
                  </button>
                </div>

                <div className="notes-v4-toolbar-group">
                  <button
                    type="button"
                    className={toolbarClass(
                      editor.isActive({ textAlign: 'left' })
                    )}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().setTextAlign('left').run()
                      )
                    }
                    title="Allinea a sinistra"
                  >
                    ⇤
                    <span>Sinistra</span>
                  </button>

                  <button
                    type="button"
                    className={toolbarClass(
                      editor.isActive({ textAlign: 'center' })
                    )}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().setTextAlign('center').run()
                      )
                    }
                    title="Centra"
                  >
                    ↔
                    <span>Centro</span>
                  </button>

                  <button
                    type="button"
                    className={toolbarClass(
                      editor.isActive({ textAlign: 'right' })
                    )}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().setTextAlign('right').run()
                      )
                    }
                    title="Allinea a destra"
                  >
                    ⇥
                    <span>Destra</span>
                  </button>

                  <button
                    type="button"
                    className={toolbarClass(
                      editor.isActive({ textAlign: 'justify' })
                    )}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().setTextAlign('justify').run()
                      )
                    }
                    title="Giustifica"
                  >
                    ☰
                    <span>Giustifica</span>
                  </button>
                </div>

                <div className="notes-v4-toolbar-group">
                  <button
                    type="button"
                    className={toolbarClass(editor.isActive('bulletList'))}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().toggleBulletList().run()
                      )
                    }
                    title="Lista puntata"
                  >
                    •
                    <span>Lista</span>
                  </button>

                  <button
                    type="button"
                    className={toolbarClass(editor.isActive('orderedList'))}
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().toggleOrderedList().run()
                      )
                    }
                    title="Lista numerata"
                  >
                    1.
                    <span>Numerata</span>
                  </button>
                </div>

                <div className="notes-v4-toolbar-group">
                  <button
                    type="button"
                    className="notes-v4-toolbar-button"
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().undo().run()
                      )
                    }
                    title="Annulla"
                  >
                    ↶
                    <span>Annulla</span>
                  </button>

                  <button
                    type="button"
                    className="notes-v4-toolbar-button"
                    onClick={() =>
                      runEditorCommand(() =>
                        editor.chain().focus().redo().run()
                      )
                    }
                    title="Ripristina"
                  >
                    ↷
                    <span>Ripristina</span>
                  </button>
                </div>
              </div>

              <div className="notes-v4-paper-wrap">
                <div className="notes-v4-paper">
                  <EditorContent editor={editor} />
                </div>
              </div>

              <footer className="notes-v4-document-footer">
                <span>
                  Ultima modifica: {formatNoteDate(selectedNote.updatedAt)}
                </span>

                <span>{plainText.trim().length} caratteri</span>
              </footer>
            </article>
          ) : (
            <div className="notes-v4-empty-document">
              <h2>Nessuna nota selezionata</h2>
              <p>Crea una nuova nota per iniziare a scrivere.</p>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateNote}
                disabled={!userId}
              >
                Crea nota
              </button>
            </div>
          )}
        </section>
      </section>

      {isDeleteModalOpen && (
        <div className="notes-delete-overlay" onClick={closeDeleteModal}>
          <div
            className="notes-delete-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="notes-delete-icon">!</div>

            <h2>Eliminare questa nota?</h2>

            <p>
              Questa azione eliminerà definitivamente la nota selezionata. Non
              potrai recuperarla dopo l’eliminazione.
            </p>

            <div className="notes-delete-preview">
              <strong>{title || 'Nota senza titolo'}</strong>
              <span>
                {plainText.trim()
                  ? plainText.trim().slice(0, 90)
                  : 'Nessun contenuto'}
              </span>
            </div>

            <div className="notes-delete-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeDeleteModal}
              >
                Annulla
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteNote}
              >
                Elimina nota
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Notes
