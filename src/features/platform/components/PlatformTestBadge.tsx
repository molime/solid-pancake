// Marks test/QA agencies in the platform lists. Test tenants are excluded
// from the dashboard metrics but their data is kept (flag is reversible).
export function PlatformTestBadge() {
  return (
    <span className="inline-flex items-center rounded-[15px] bg-[rgba(154,166,168,0.16)] px-2 py-0.5 text-[12px] font-semibold text-[#9aa6a8]">
      Test
    </span>
  )
}
