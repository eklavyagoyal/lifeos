import Link from 'next/link';
import { getAllNotes } from '@/server/services/notes';
import { CreateNoteButton } from '@/components/notes/create-note-button';
import { formatDate } from '@/lib/utils';
import { StickyNote } from 'lucide-react';

export const metadata = { title: 'Notes — lifeOS' };
export const dynamic = 'force-dynamic';

export default function NotesPage() {
  const allNotes = getAllNotes();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker">Commonplace</div>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Notes</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Notes should feel calm and useful here, like a living shelf rather than a pile of plain text blocks.
          </p>
        </div>
        <CreateNoteButton />
      </div>

      {allNotes.length === 0 ? (
        <div className="secondary-empty-state py-12">
          <StickyNote size={32} className="mb-2 text-text-muted" />
          <p className="text-sm text-text-muted">No notes yet.</p>
          <p className="text-2xs text-text-muted mt-1">Create your first note to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allNotes.map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`}>
              <div className="secondary-card cursor-pointer">
                <h3 className="text-sm font-medium text-text-primary truncate">{note.title}</h3>
                {note.body && (
                  <p className="mt-3 text-sm leading-6 text-text-tertiary line-clamp-4">
                    {note.body.slice(0, 150)}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  {note.noteType && note.noteType !== 'note' && (
                    <span className="secondary-chip text-2xs">
                      {note.noteType}
                    </span>
                  )}
                  <span className="text-2xs text-text-muted">
                    {formatDate(note.updatedAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
