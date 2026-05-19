import styles from './Footer.module.css'

const LINKS = [
  { href: 'https://sergeshaneri.github.io/socionics-wiki/thanks/', label: 'Поблагодарить' },
  { href: 'https://sergeshaneri.github.io/Socionics/',             label: 'Узнать свой тип' },
  { href: 'https://sergeshaneri.github.io/socionics-wiki/',        label: 'Соционика-вики' },
  { href: 'https://t.me/SergeyShaneri',                            label: 'Обсудить с автором' },
]

export default function Footer() {
  return (
    <footer className={styles.footer}>
      {LINKS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {label}
        </a>
      ))}
    </footer>
  )
}
