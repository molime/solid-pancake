export interface UploadFileOptions {
  generateUploadUrl: (args: {
    clerkOrgId: string
  }) => Promise<{ url: string }>
  clerkOrgId: string
  file: File
}

function rewriteUrlOriginToCurrent(url: string) {
  const parsed = new URL(url)
  return `${window.location.origin}${parsed.pathname}${parsed.search}`
}

export async function uploadFileToConvex({
  generateUploadUrl,
  clerkOrgId,
  file,
}: UploadFileOptions) {
  const { url } = await generateUploadUrl({ clerkOrgId })

  const uploadUrl = import.meta.env.DEV
    ? rewriteUrlOriginToCurrent(url)
    : url

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`)
  }

  const { storageId } = (await response.json()) as { storageId: string }
  return storageId
}
