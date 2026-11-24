export default function GeneratingSpinner() {
  return (
    <div className="flex items-center gap-1" aria-label="Generating">
      <span className="spinner-dot" />
      <span className="spinner-dot" />
      <span className="spinner-dot" />
    </div>
  )
}
