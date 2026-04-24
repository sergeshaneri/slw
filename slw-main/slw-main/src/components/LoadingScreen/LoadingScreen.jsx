import styles from './LoadingScreen.module.css'

export default function LoadingScreen({ text }) {
  return (
    <div className={styles.container}>
      <div className={styles.text}>{text}</div>
    </div>
  )
}
