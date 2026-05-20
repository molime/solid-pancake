import { useOrganization } from '@clerk/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { Textarea } from '@/shared/ui/Textarea'
import { Search, Upload, BookOpen, Loader2 } from 'lucide-react'

type SearchResult = FunctionReturnType<
  typeof api.search.searchCompliance
>[number]

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

export function SearchPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const search = useAction(api.search.searchCompliance)
  const createDoc = useMutation(api.search.createComplianceDoc)
  const member = useQuery(api.members.me, clerkOrgId ? { clerkOrgId } : 'skip')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [newDoc, setNewDoc] = useState({
    title: '',
    body: '',
    category: 'documentation' as
      | 'billing'
      | 'documentation'
      | 'credentialing'
      | 'policy',
    visibility: 'all_staff' as 'all_staff' | 'admins_coordinators',
  })

  const role = member?.role ?? 'org:caregiver'
  const canUpload = role === 'org:admin' || role === 'org:coordinator'

  const debouncedSearch = useCallback(
    async (q: string) => {
      if (!clerkOrgId || q.length < MIN_QUERY_LENGTH) {
        setResults([])
        setSearched(false)
        return
      }
      setLoading(true)
      setSearched(true)
      try {
        const res = await search({ clerkOrgId, query: q })
        setResults(res)
      } catch (err) {
        console.error('Search error:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [clerkOrgId, search],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      debouncedSearch(query.trim())
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, debouncedSearch])

  const handleUpload = async () => {
    if (!clerkOrgId || !newDoc.title.trim() || !newDoc.body.trim()) return
    setUploading(true)
    try {
      await createDoc({
        clerkOrgId,
        title: newDoc.title.trim(),
        body: newDoc.body.trim(),
        category: newDoc.category,
        visibility: newDoc.visibility,
      })
      setNewDoc({
        title: '',
        body: '',
        category: 'documentation',
        visibility: 'all_staff',
      })
      setShowUpload(false)
      // Re-run search if query exists
      if (query.trim().length >= MIN_QUERY_LENGTH) {
        debouncedSearch(query.trim())
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-atria-ink">
            Knowledge Search
          </h1>
          <p className="text-sm text-atria-muted">
            Search agency knowledge docs, compliance guides, and policies
          </p>
        </div>
        {canUpload && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowUpload((s) => !s)}
          >
            <Upload className="h-4 w-4" />
            {showUpload ? 'Cancel' : 'Create article'}
          </Button>
        )}
      </div>

      {showUpload && canUpload && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium text-atria-ink">
              Create Knowledge Article
            </h3>
            <Input
              value={newDoc.title}
              onChange={(e) =>
                setNewDoc((d) => ({ ...d, title: e.target.value }))
              }
              placeholder="Document title"
            />
            <div className="flex gap-3">
              <select
                value={newDoc.category}
                onChange={(e) =>
                  setNewDoc((d) => ({
                    ...d,
                    category: e.target.value as typeof newDoc.category,
                  }))
                }
                className="h-9 w-full rounded-md border border-atria-border bg-white px-3 text-sm text-atria-ink"
              >
                <option value="documentation">Documentation</option>
                <option value="billing">Billing</option>
                <option value="credentialing">Credentialing</option>
                <option value="policy">Policy</option>
              </select>
              <select
                value={newDoc.visibility}
                onChange={(e) =>
                  setNewDoc((d) => ({
                    ...d,
                    visibility: e.target.value as typeof newDoc.visibility,
                  }))
                }
                className="h-9 w-full rounded-md border border-atria-border bg-white px-3 text-sm text-atria-ink"
              >
                <option value="all_staff">All staff</option>
                <option value="admins_coordinators">
                  Admins & coordinators only
                </option>
              </select>
            </div>
            <Textarea
              value={newDoc.body}
              onChange={(e) =>
                setNewDoc((d) => ({ ...d, body: e.target.value }))
              }
              placeholder="Document body text..."
              rows={4}
            />
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                disabled={
                  uploading || !newDoc.title.trim() || !newDoc.body.trim()
                }
                onClick={handleUpload}
              >
                {uploading ? 'Saving…' : 'Save document'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-atria-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Type at least ${MIN_QUERY_LENGTH} characters to search...`}
          className="pl-9"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-4 w-4 animate-spin text-atria-muted" />
          <span className="text-sm text-atria-muted">Searching…</span>
        </div>
      )}

      <div className="space-y-2">
        {!loading &&
          results.map((doc) => (
            <Card
              key={doc._id}
              className="hover:border-atria-accent transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-atria-ink">
                    {doc.title}
                  </h3>
                  <Badge variant="default">{doc.category}</Badge>
                </div>
                <p className="text-xs text-atria-muted line-clamp-3">
                  {doc.body}
                </p>
              </CardContent>
            </Card>
          ))}

        {!loading &&
          searched &&
          results.length === 0 &&
          query.length >= MIN_QUERY_LENGTH && (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <BookOpen className="h-8 w-8 text-atria-muted/40" />
              <p className="text-sm text-atria-muted">No results found</p>
              <p className="text-xs text-atria-muted">
                Try a different search term
              </p>
            </div>
          )}

        {!searched && query.length < MIN_QUERY_LENGTH && (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Search className="h-8 w-8 text-atria-muted/40" />
            <p className="text-sm text-atria-muted">
              Start typing to search knowledge docs
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
