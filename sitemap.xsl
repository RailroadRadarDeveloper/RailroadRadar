<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Sitemap · RailroadRadar</title>
        <style>
          body { margin: 0; background: #07093e; color: #fff; font: 16px/1.5 Arial, sans-serif; }
          main { max-width: 760px; margin: 0 auto; padding: 28px 18px 48px; }
          a { color: #fff; }
          .logo { height: 42px; width: auto; }
          h1 { font-size: 28px; margin: 18px 0 6px; }
          p { color: rgba(255,255,255,.78); margin: 0 0 18px; }
          ul { list-style: none; padding: 0; margin: 0; }
          li { border-top: 1px solid rgba(255,255,255,.16); }
          li a { display: block; padding: 14px 2px; text-decoration: none; font-weight: 700; }
          li a:hover { color: #0ac700; }
          small { display: block; font-weight: 400; color: rgba(255,255,255,.62); margin-top: 2px; }
        </style>
      </head>
      <body>
        <main>
          <a href="/"><img class="logo" src="/assets/logo-halloween.png?v=oct" alt="RailroadRadar"/></a>
          <h1>Sitemap</h1>
          <p>Public pages on RailroadRadar.</p>
          <ul>
            <xsl:for-each select="s:urlset/s:url">
              <li>
                <a>
                  <xsl:attribute name="href"><xsl:value-of select="s:loc"/></xsl:attribute>
                  <xsl:value-of select="s:loc"/>
                  <small>
                    <xsl:if test="s:lastmod">Updated <xsl:value-of select="s:lastmod"/></xsl:if>
                  </small>
                </a>
              </li>
            </xsl:for-each>
          </ul>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
