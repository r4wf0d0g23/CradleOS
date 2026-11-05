from pathlib import Path
from html.parser import HTMLParser
import json, xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]/'cradleos-dapp'
dist=root/'dist'
class Document(HTMLParser):
 def __init__(self): super().__init__(); self.tags=[]
 def handle_starttag(self,t,a): self.tags.append((t,dict(a)))
urls=[n.text for n in ET.parse(dist/'sitemap.xml').findall('{*}url/{*}loc')]
assert len(urls)==5 and len(set(urls))==5
for u in urls:
 assert u.startswith('https://cradleos.io/') and '#' not in u
 path=u.removeprefix('https://cradleos.io/')
 f=dist/path/'index.html'; s=f.read_text(); d=Document();d.feed(s)
 assert sum(t=='h1' for t,a in d.tags)==1
 assert any(t=='link' and a.get('rel')=='canonical' and a.get('href')==u for t,a in d.tags)
 assert any(t=='meta' and a.get('name')=='description' and a.get('content') for t,a in d.tags)
 assert not any(t=='meta' and a.get('name')=='robots' and 'noindex' in a.get('content','') for t,a in d.tags)
 for t,a in d.tags:
  href=a.get('href','')
  if href.startswith('/'):
   target=href.split('#')[0].split('?')[0]
   local=dist/target.lstrip('/')
   assert local.exists(),(u,href)
 if path:assert not any(t=='script' and a.get('type')!='application/ld+json' for t,a in d.tags)
 assert 'Casino awaiting a new bankroll' not in s
robots=(dist/'robots.txt').read_text();assert '<html' not in robots and 'Sitemap: https://cradleos.io/sitemap.xml' in robots
assert '/partners/' not in robots
assert '/partners/metrics /partners/metrics/ 301' in (dist/'_redirects').read_text()
assert 'X-Robots-Tag: noindex, nofollow' in (dist/'_headers').read_text()
for f in (root/'public/guide').rglob('*'):
 if f.is_file():assert f.read_bytes()==(dist/f.relative_to(root/'public')).read_bytes()
print(json.dumps({'canonicalPublicPages':len(urls),'sitemapXML':True,'localLinksExist':True,'guideNeedsNoJavaScript':True,'partnerNoindexPreserved':True}))
