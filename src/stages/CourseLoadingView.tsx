import { PackageIcon } from '../ui/PackageIcon'

interface CourseLoadingViewProps {
  courseName?: string
  iconSvg?: string
}

export function CourseLoadingView({ courseName, iconSvg }: CourseLoadingViewProps) {
  return (
    <main className="sx-course-loading" aria-busy="true" aria-live="polite">
      <div className="sx-course-loading-card">
        {iconSvg ? (
          <PackageIcon svg={iconSvg} size={56} />
        ) : (
          <div className="sx-course-loading-orb" aria-hidden="true" />
        )}
        <div className="sx-course-loading-copy">
          <h2>Loading course&hellip;</h2>
          {courseName && <span>{courseName}</span>}
        </div>
        <div className="sx-course-loading-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  )
}
