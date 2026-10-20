import { useConvex } from 'convex/react'
import { api } from '../../../convex/_generated/api'

/**
 * Fire-and-forget audit for file/document downloads. The download-URL
 * generators (files.getDownloadUrl, documentArchive.getItemDownloadUrl,
 * candidates.getPrefilledDocumentDownloadUrl) are Convex queries and are
 * read-only — queries cannot write audit rows. The `file.downloaded` event
 * is therefore recorded from the download click handler, the same trigger
 * the design doc documents for data exports. Only identifying metadata is
 * sent; never file content. A failed audit write never blocks the download.
 */
export function useAuditFileDownload() {
  const convex = useConvex()
  return (args: {
    clerkOrgId: string
    fileName?: string
    contentType?: string
    linkedType?: string
    linkedId?: string
  }) => {
    void convex.mutation(api.audit.recordFileDownload, args).catch(() => {})
  }
}
