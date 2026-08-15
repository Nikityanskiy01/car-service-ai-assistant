/** Optional SheetJS loader — not a runtime dependency of the API image. */
export async function loadXlsx() {
  try {
    return await import('xlsx');
  } catch {
    throw new Error(
      'xlsx is not installed. These offline import scripts are optional: npm --prefix backend install xlsx --no-save',
    );
  }
}
