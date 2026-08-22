import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FerrofluidEffect } from './ferrofluid-effect.jsx'
import { Terminal } from './terminal'
import { posts } from './posts'

export default function App() {
  const [openSlug, setOpenSlug] = useState(null)
  const [lang, setLang] = useState('en')

  const handleOpenSlug = (slug) => {
    setOpenSlug(slug)
  }

  // when the column content changes, start from the top of the column
  useEffect(() => {
    document.querySelector('.col-content')?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }, [openSlug])

  // escape goes back from an expanded post
  useEffect(() => {
    if (!openSlug) return
    const onKey = (e) => {
      if (e.key === 'Escape') handleOpenSlug(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSlug])

  return (
    <div className="site">
      <div className="bar bar-top" />

      <div className="split">
        <div className="hero-left">
          <FerrofluidEffect element="fire" preview />
        </div>

        <div className="bar bar-mid" />

        <div className="hero-right">
          <div className="col-top-bar">
            <div className="lang-switcher">
              <button
                className={`lang-btn ${lang === 'zh' ? 'active' : ''}`}
                onClick={() => setLang('zh')}
              >
                中文
              </button>
              <span className="lang-sep">/</span>
              <button
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </div>
          </div>

          <div className="col-content">
            {openSlug ? (
              <PostArticle
                slug={openSlug}
                lang={lang}
                onBack={() => handleOpenSlug(null)}
              />
            ) : (
              <>
                <PostList list={posts} lang={lang} onOpen={handleOpenSlug} />
                <div className="terminal-desktop-only">
                  <Terminal lang={lang} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {!openSlug && (
        <Terminal lang={lang} className="terminal-mobile-only" />
      )}

      <div className="bar bar-bottom">
        <a
          className="bar-link"
          href="https://github.com/zknmoe/moe.page-subdomains"
          target="_blank"
          rel="noreferrer"
        >
          {lang === 'zh'
            ? '本页面在 moe.page 上免费托管，点击了解详情'
            : 'This page is hosted for free on moe.page, learn how here'}
        </a>
      </div>
    </div>
  )
}

function PostList({ list, lang, onOpen }) {
  return (
    <div className="post-list">
      {list.map((p) => {
        const itemData = p[lang] || p.en
        return (
          <div
            key={p.slug}
            className="post-item"
            style={{ cursor: 'pointer' }}
            onClick={() => onOpen(p.slug)}
          >
            <time className="post-date">{p.date}</time>
            <div>
              <h3 className="post-title">{itemData.title}</h3>
              <p className="post-excerpt">{itemData.excerpt}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PostArticle({ slug, lang, onBack }) {
  const post = posts.find((p) => p.slug === slug)
  const [hasOverflow, setHasOverflow] = useState(false)

  useEffect(() => {
    const checkOverflow = () => {
      const isMobile = window.innerWidth <= 768
      if (isMobile) {
        const docHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        )
        setHasOverflow(docHeight > window.innerHeight + 80)
      } else {
        const container = document.querySelector('.col-content')
        if (container) {
          setHasOverflow(container.scrollHeight > container.clientHeight + 20)
        }
      }
    }

    // Check after DOM layout updates
    const timer = setTimeout(checkOverflow, 100)
    window.addEventListener('resize', checkOverflow)
    window.addEventListener('scroll', checkOverflow)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', checkOverflow)
      window.removeEventListener('scroll', checkOverflow)
    }
  }, [slug, lang])

  const scrollToTop = () => {
    const isMobile = window.innerWidth <= 768
    if (isMobile) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      document.querySelector('.col-content')?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (!post) {
    return (
      <p className="muted">
        {lang === 'zh' ? '文章未找到' : 'POST NOT FOUND'}
      </p>
    )
  }

  const articleData = post[lang] || post.en
  const content = articleData.content || post.en.content

  return (
    <article className="post">
      <button className="back-link" onClick={onBack}>
        {lang === 'zh' ? '← 返回' : '← BACK'}
      </button>
      <header className="post-header">
        <time className="post-date">{post.date}</time>
        <h1 className="page-title">{articleData.title}</h1>
      </header>
      <div className="post-content">
        {typeof content === 'string' ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        ) : (
          content
        )}
      </div>

      {hasOverflow && (
        <div className="post-footer-nav">
          <button className="top-nav-btn" onClick={scrollToTop}>
            {lang === 'zh' ? '↑ 返回顶部' : '↑ TOP'}
          </button>
        </div>
      )}
    </article>
  )
}
