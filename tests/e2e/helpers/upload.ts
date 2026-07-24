import { callConvexMutation } from './seed'

export function minimalPdfBuffer(): Buffer {
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
xref
0 3
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
trailer
<< /Size 3 /Root 1 0 R >>
startxref
106
%%EOF`
  return Buffer.from(body, 'utf8')
}

export async function uploadPdfStorageId(token: string, clerkOrgId: string): Promise<string> {
  const upload = (await callConvexMutation(token, 'files:generateUploadUrl', {
    clerkOrgId,
  })) as { value?: { url?: string }; url?: string }
  const url = upload.value?.url ?? upload.url
  if (!url) throw new Error('files:generateUploadUrl did not return an upload URL.')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: new Uint8Array(minimalPdfBuffer()),
  })
  if (!response.ok) {
    throw new Error(`Convex storage upload failed: ${response.status}`)
  }
  const { storageId } = (await response.json()) as { storageId: string }
  return storageId
}

export async function attachCandidateDocumentForE2E(
  token: string,
  clerkOrgId: string,
  documentType: string,
  label: string,
  expiresAt?: string,
) {
  const storageId = await uploadPdfStorageId(token, clerkOrgId)
  await callConvexMutation(token, 'candidates:attachCandidateDocument', {
    clerkOrgId,
    storageId,
    fileName: `${documentType}.pdf`,
    contentType: 'application/pdf',
    size: minimalPdfBuffer().length,
    documentType,
    label,
    expiresAt,
  })
}
