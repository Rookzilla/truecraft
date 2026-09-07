import { IconGrid } from '../../ui/IconLists'
import type { IconItem, LanguageCopy } from '../../../types/content'

export function ExperienceBlock({ copy, hiringRealities }: { copy: LanguageCopy; hiringRealities: IconItem[] }) {
  return (
    <>
      <div className="copy-block">
        <span className="section-kicker experience-kicker">{copy.titles.about.experienceKicker}</span>
        <p>{copy.details.about.experienceTextOne}</p>
        <p>{copy.details.about.experienceTextTwo}</p>
        <h3>{copy.titles.about.experienceTitle}</h3>
      </div>
      <IconGrid items={hiringRealities} variant="compact" />
    </>
  )
}
