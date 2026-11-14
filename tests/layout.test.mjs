import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import postcss from 'postcss'
import { STUDIO_INSPIRATIONS, EXTERNAL_MODEL_DIRECTORY } from '../app/utils/reference-content.js'
import { REFERENCE_MODEL_NAMES } from '../app/utils/prompt-engine.js'
import { legacyRedirectTarget } from '../server/prod-server.mjs'
const source = path => readFileSync(path, 'utf8')
const home = source('app/pages/index.vue')
const studio = source('app/pages/studio.vue')
const creation = source('app/components/StudioCreationPanel.vue')
const css = source('app/assets/css/main.css')
const store = source('app/composables/useProjectStore.js')
const openingSource = source('app/components/StudioCreationPanel.vue')

test('core tools are free, support opens Buy Me a Coffee and dark mode is saved', () => {
  const support=source('app/components/SupportLink.vue')
  assert.match(support,/>Support the project</)
  assert.match(support,/href="https:\/\/buymeacoffee.com\/enzoc1977r"/)
  assert.match(support,/target="_blank"/)
  assert.match(support,/rel="noopener"/)
  assert.doesNotMatch(support,/AppModal|aria-haspopup/)
  assert.match(creation,/Free · Local · No account/)
  assert.match(source('app/components/WorkspaceHeader.vue'),/Free · Local · No account/)
  assert.doesNotMatch(source('app/components/WorkspaceHeader.vue'),/guest|Later|Sign in/)
  assert.match(source('app/components/SiteFooter.vue'),/buymeacoffee\.com\/enzoc1977r/)
  assert.match(source('app/components/WorkspaceHeader.vue'),/<SupportLink \/>/)
  const preferences=source('app/utils/preferences.js')
  assert.match(preferences,/shotboard.preferences.v1/)
  assert.match(preferences,/darkMode:false/)
  assert.match(source('app/composables/usePreferences.js'),/useProjectStore/)
  assert.match(css,/\.shotboard-dark \.studio-shell \{/)
  assert.doesNotMatch(css,/\.profile-layout|\.pricing-page|\.auth-shell|\.apple-language/)
})

test('core workflow has no feature quota and preserves old workspace backups', () => {
  assert.doesNotMatch(store,/length\s*>=\s*48|slice\(0,\s*40\)|slice\(0,\s*5\)/)
  assert.match(store,/backup\.schema/)
  assert.match(source('app/utils/prompt-engine.js'),/canonicalShotCount\(options\.count\)/)
  assert.doesNotMatch(source('app/utils/prompt-engine.js'),/project\.shots\.length > 48/)
})

test('every active Vue single-file component parses and compiles', () => {
  const files=[]
  function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())walk(path);else if(path.endsWith('.vue')&&!/ \d+\.vue$/.test(path))files.push(path)}}
  walk('app')
  assert.ok(files.length>10)
  for(const file of files){
    const {descriptor,errors}=parse(source(file),{filename:file})
    assert.deepEqual(errors,[],file)
    const script=descriptor.script||descriptor.scriptSetup
    if(!script)continue
    const compiled=compileScript(descriptor,{id:file})
    const result=compileTemplate({id:file,filename:file,source:descriptor.template.content,compilerOptions:{bindingMetadata:compiled.bindings}})
    assert.deepEqual(result.errors,[],file)
  }
})

test('Check 33 home keeps studies, FAQs, wording and named controls', () => {
  for(const title of ['Snow Fight','Dragon Chase','The Lab','The Climb','Mech Reveal','Solo Corridor','Machine Room','High Country'])assert.ok(home.includes(`title:'${title}'`),title)
  const headings=['Pick a genre. We speak its language.','How it works','Reference stills','Frequently asked questions','Create a storyboard']
  let previous=-1
  for(const heading of headings){const position=home.indexOf(heading);assert.ok(position>previous,heading);previous=position}
  for(const text of ['does not render a clip','Paste a prompt into Grok Imagine, Google, or any other AI image or video model','not renders from Moovicut','battles'])assert.ok(home.includes(text),text)
  assert.doesNotMatch(home,/Real renders from the Moovicut pipeline|hit render|Download the clip|Create AI movies online|finished clip out/)
  assert.doesNotMatch(source('app/pages/index.vue'),/LanguageHint|LanguagePicker|apple-language/)
  assert.doesNotMatch(source('app/pages/faq.vue'),/LanguageHint|LanguagePicker/)
  assert.equal((home.match(/<FaqDisclosure/g)||[]).length,1)
  assert.match(home,/v-for="\[question,answer\] in faqs"/)
  assert.match(home,/class="process-grid" aria-label="How it works"/)
  assert.match(home,/One sentence in, an editable shot list out/)
  assert.match(source('app/components/FaqDisclosure.vue'),/<h3 class="faq-question"><button/)
  assert.doesNotMatch(source('app/components/AppHeader.vue'),/<LanguagePicker/)
})

test('Check 34 paid plans are gone and tips stay on the support link', () => {
  assert.equal(legacyRedirectTarget('/pricing'), '/studio')
  assert.doesNotMatch(studio,/name:'(?:Basic|Pro|Max|Enterprise)'|pricing-hero/)
  const support=source('app/components/SupportLink.vue')
  assert.match(support,/href="https:\/\/buymeacoffee.com\/enzoc1977r" target="_blank" rel="noopener"/)
  assert.doesNotMatch(source('app/components/AppHeader.vue'),/Pricing/)
  assert.doesNotMatch(source('app/components/SiteFooter.vue'),/>Pricing</)
})

test('Check 33 Studio has a real two-column creation form and retained editor', () => {
  for(const text of ['Create a storyboard','My Projects','Board tools'])assert.ok(studio.includes(text),text)
  assert.match(studio,/<WorkspaceSidebar/)
  assert.match(studio,/<WorkspaceHeader/)
  assert.match(studio,/<StudioCreationPanel \/>/)
  assert.match(studio,/<StudioEditor \/>/)
  assert.match(studio,/importProject/)
  assert.match(studio,/exportJson/)
  for(const text of ['Free · Local · No account','Describe your idea in detail','Write an idea on the left, then create the storyboard.','Create storyboard'])assert.ok(creation.includes(text),text)
  assert.match(creation,/<form class="studio-create-form"[^>]*@submit\.prevent="createStoryboard"/)
  assert.match(creation,/class="studio-main"/)
  assert.match(creation,/async function readReference\(event\)/)
  assert.match(creation,/function dropReference\(event\)/)
  assert.match(creation,/URL\.revokeObjectURL\(referencePreview\.value\)/)
  assert.match(creation,/aria-label="Upload reference image"/)
  const editor=source('app/components/StudioEditor.vue')
  for(const method of ['store.undo()','store.redo()','store.persist()','store.importProject','store.moveShot','store.removeShot','store.insertShot','store.addShotAtEnd','store.loadProject','store.removeSavedProject'])assert.ok(editor.includes(method),method)
  assert.match(editor,/<ShotCard/)
  assert.equal(STUDIO_INSPIRATIONS.length,8)
  assert.deepEqual(EXTERNAL_MODEL_DIRECTORY, ['Grok Imagine', 'Google (Veo / Gemini)'])
  assert.deepEqual(REFERENCE_MODEL_NAMES, ['Grok Imagine', 'Google (Veo / Gemini)'])
})

test('profile addresses open the studio and the library stays in the studio', () => {
  assert.equal(legacyRedirectTarget('/profile'), '/studio')
  assert.equal(legacyRedirectTarget('/zh/profile'), '/studio')
  assert.match(studio,/exportLibrary/)
  assert.match(studio,/store\.restoreBackup\(parsed\)/)
  assert.match(studio,/v-for="project in store\.savedProjects"/)
  assert.doesNotMatch(source('app/components/WorkspaceSidebar.vue'),/aria-label="Profile"|\/profile/)
  assert.doesNotMatch(source('app/components/AppHeader.vue'),/\/profile|identity\.name/)
  assert.match(store,/savedProjects\.value = \[\]/)
  assert.match(source('app/composables/useNotifier.js'),/downloadText/)
  assert.doesNotMatch(source('app/composables/useNotifier.js'),/shotboardDesktop|moovicutDesktop/)
})

test('retired account routes open the studio instead of an account page', () => {
  for (const path of ['/login', '/signin', '/auth/login', '/auth/signin', '/auth/callback', '/dashboard/ai-video/home', '/de/dashboard/ai-video/home']) {
    assert.equal(legacyRedirectTarget(path), '/studio', path)
  }
  assert.equal(legacyRedirectTarget('/desktop'), '/studio')
  assert.equal(legacyRedirectTarget('/ja/desktop'), '/studio')
  assert.equal(legacyRedirectTarget('/shotboard/desktop'), '/studio')
  assert.equal(legacyRedirectTarget('/shotboard/faq'), '/faq')
  assert.equal(legacyRedirectTarget('/es/privacy'), '/privacy')
  assert.equal(legacyRedirectTarget('/fr'), '/')
  assert.equal(legacyRedirectTarget('/shotboard/faq?ref=old'), '/faq?ref=old')
  assert.doesNotMatch(source('app/components/AppHeader.vue'), /signin-link|Sign In/)
  assert.doesNotMatch(source('app/components/WorkspaceHeader.vue'), /workspace-signin|Sign in \(optional\)/)
  assert.doesNotMatch(source('app/components/WorkspaceSidebar.vue'), /\/auth\/login/)
  assert.match(source('app/components/OriginalStill.vue'), /joinAppPath\(useRuntimeConfig\(\)\.app\.baseURL, stillSrc\(/)
})

test('Check 35 Studio has no nested form and restores its two preview studies', () => {
  assert.match(studio,/id="studio-heading" class="studio-page-title"/)
  assert.match(creation,/<form class="studio-create-form"[\s\S]*<\/form><\/div>[\s\S]*<form class="studio-bottom-composer"/)
  assert.match(creation,/v-for="study in visibleStudies"/)
  assert.equal(new Set(STUDIO_INSPIRATIONS.slice(0,2).map(study=>study.file)).size,2)
  const footerSource=source('app/components/SiteFooter.vue')
  assert.doesNotMatch(footerSource,/>English</)
  assert.doesNotMatch(footerSource,/footerLanguageOpen|footer-language-links/)
  assert.equal(legacyRedirectTarget('/developers'), '/studio')
  assert.equal(legacyRedirectTarget('/ko/developers'), '/studio')
  assert.doesNotMatch(footerSource,/\/developers|For AI agents/)
  assert.match(source('app/components/SupportLink.vue'),/buymeacoffee\.com\/enzoc1977r/)
  for(const text of ['Free · Local · No account','JSON export'])assert.ok(studio.includes(text)||creation.includes(text),text)
})

test('Check 35 hidden headings and duplicate layout offsets are removed', () => {
  assert.match(css,/:is\(h1,h2,h3,h4\) \{ margin:0; \}/)
  const root=postcss.parse(css)
  const values=[]
  root.walkRules('.studio-workspace',rule=>rule.walkDecls('margin-left',decl=>values.push(decl.value)))
  assert.ok(values.every(value=>value==='0'),JSON.stringify(values))
  for(const token of ['max-width:768px','grid-template-columns:repeat(2,minmax(0,1fr))','padding:24px 16px'])assert.ok(css.includes(token),token)
})

test('Footer, navigation and dialogs preserve named accessible controls', () => {
  const footer=source('app/components/SiteFooter.vue')
  const sidebar=source('app/components/WorkspaceSidebar.vue')
  const header=source('app/components/WorkspaceHeader.vue')
  for(const selector of ['class="footer-inner"','class="footer-bar"','>Studio</','>FAQ</','>Tips</'])assert.ok(footer.includes(selector),selector)
  assert.doesNotMatch(footer,/agent-links|llms\.txt|>English</)
  assert.doesNotMatch(footer,/简体中文|Русский|português|Türkçe/)
  for(const name of ['Create','Storyboard','My Projects'])assert.ok(sidebar.includes(`aria-label="${name}"`),name)
  assert.doesNotMatch(sidebar,/aria-label="Profile"|aria-label="Settings"|aria-label="Models"|AI Models|For AI agents|\/developers|#studio-model/)
  assert.match(creation,/aria-label="Prompt target"/)
  assert.match(creation,/Grok Imagine/)
  assert.match(creation,/Google \(Veo \/ Gemini\)/)
  assert.match(sidebar,/aria-label="Workspace sidebar"/)
  assert.match(header,/aria-controls="mobile-workspace-menu"/)
  assert.match(header,/:aria-expanded="menuOpen"/)
  assert.match(header,/:aria-label="menuOpen \? 'Close workspace navigation' : 'Open workspace navigation'"/)
  assert.match(studio,/id="mobile-workspace-menu"/)
  assert.match(creation,/<form[^>]*@submit\.prevent="createStoryboard"/)
  assert.equal(legacyRedirectTarget('/profile'), '/studio')
  assert.match(source('app/plugins/00.init.client.js'),/window\.Shotboard = Object\.freeze/)
  assert.doesNotMatch(source('app/components/AppHeader.vue'),/\/developers|For AI agents/)
  assert.doesNotMatch(studio,/\/developers|Agent tools|Open developer guide/)
  const modal=source('app/components/AppModal.vue')
  assert.match(modal,/role="dialog"/)
  assert.match(modal,/aria-modal="true"/)
  assert.match(modal,/releaseFocus\(\)/)
})

test('Check 38 applies measured typography, offsets and responsive layouts', () => {
  const root=postcss.parse(css)
  function declarations(selector,media) {
    const container=media?root.nodes.find(node=>node.type==='atrule'&&node.name==='media'&&node.params===media.replace(/^@media\s*/,'')):root
    const rule=container?.nodes.filter(node=>node.type==='rule').find(node=>node.selector===selector)
    return Object.fromEntries(rule?.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value])||[])
  }
  assert.equal(declarations('.container-medium')['max-width'],'1024px')
  assert.equal(declarations('.container-narrow')['max-width'],'768px')
  assert.equal(declarations('.split-feature')['max-width'],'1024px')
  assert.equal(declarations('.site-header > .header-inner').width,'100%')
  assert.equal(declarations('.footer-top','@media (max-width:767px)')['grid-template-columns'],'repeat(3,minmax(0,1fr))')
  assert.doesNotMatch(css,/\.profile-main|\.pricing-heading|\.pricing-plan|\.auth-shell/)
  assert.equal(declarations('.site-main')['padding-top'],'64px')
  assert.equal(declarations('.hero-section').padding,'144px 0 112px')
  assert.equal(declarations('.section').padding,'96px 0')
  assert.equal(declarations('.hero-copy h1')['font-size'],'60px')
  assert.equal(declarations('.section-heading h2')['font-size'],'36px')
  assert.equal(declarations('.hero-section','@media (max-width:1023px)').padding,'144px 0 112px')
  assert.equal(declarations('.hero-copy h1','@media (max-width:1023px)')['font-size'],'48px')
  assert.equal(declarations('.hero-section','@media (max-width:767px)').padding,'112px 0 80px')
  assert.equal(declarations('.hero-copy h1','@media (max-width:767px)')['font-size'],'36px')
  assert.equal(declarations('.section','@media (max-width:767px)').padding,'80px 0')
  assert.equal(declarations('.workflow-grid','@media (max-width:767px)')['grid-template-columns'],'minmax(0,1fr)')
  assert.equal(declarations('.header-inner','@media (max-width:1023px)').padding,'0 24px')
  assert.equal(declarations('.header-inner','@media (max-width:767px)').padding,'0 16px')
  assert.equal(declarations('.workspace-topbar','@media (max-width:1023px)').padding,'8px 12px')
  assert.equal(declarations('.workspace-sidebar','@media (max-width:1023px)').display,'none')
  assert.equal(declarations('.studio-main','@media (max-width:1023px)')['grid-template-columns'],'minmax(0,1fr)')
  assert.equal(declarations('.studio-main','@media (max-width:767px)')['grid-template-columns'],'minmax(0,1fr)')
  assert.equal(declarations('.studio-main')['grid-template-columns'],'minmax(0,1fr) minmax(0,1.15fr)')
  assert.equal(declarations('.studio-landing-main').padding,'0 8px 16px')
  assert.equal(declarations('.studio-model-directory').padding,'0')
  assert.equal(declarations('.studio-main').padding,'0')
  assert.doesNotMatch(source('app/pages/index.vue'),/Passer en Français|La langue de votre navigateur/)
  assert.match(home,/v-for="example in examples"/)
  assert.match(studio,/Create a storyboard/)
  assert.match(creation,/Storyboard settings/)
  assert.doesNotMatch(css,/(?:body|html|\.site-shell|\.studio-shell|\.auth-shell|\.profile-layout)\s*\{[^}]*overflow(?:-x)?:hidden/)
})

test('Check 37 restores the measured forms, galleries, footer and profile hierarchy',()=>{
  assert.equal(legacyRedirectTarget('/profile'), '/studio')
  assert.match(source('app/components/SupportLink.vue'),/buymeacoffee\.com\/enzoc1977r/)
  assert.doesNotMatch(css,/\.profile-security-controls|\.profile-columns|\.auth-login-panel|\.auth-scene-copy/)
  assert.doesNotMatch(source('app/components/SiteFooter.vue'),/>English</)
  assert.doesNotMatch(source('app/components/SiteFooter.vue'),/footerLanguageOpen|LanguagePicker/)
  for(const token of ['padding:20px 24px','max-width:768px','background:#ecfdf5'])assert.ok(css.includes(token),token)
  assert.match(css,/\.studio-inspiration-cards\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(css,/\.footer-top\s*\{[^}]*grid-template-columns:288px repeat\(3,minmax\(0,1fr\)\)/)
})

test('canonical CSS parses with light workspace routes and dark home/login', () => {
  const root = postcss.parse(css)
  root.walkDecls(decl => {
    assert.doesNotMatch(decl.value, /var\(--[a-z-]+;/)
    assert.doesNotMatch(decl.value, /\{;/)
  })
  for(const token of ['color-scheme:dark','--bg:#0a0a0a;--bg-alt:#0f0f0f;--surface:#141414','--text:#18181b;--text-secondary:#71717a','--text:#eae7df','#ecfdf5','#c8c3b6','#a1a1aa'])assert.ok(css.includes(token),token)
  assert.match(css,/\.process-number\s*\{[^}]*color:var\(--text-secondary\)/)
  assert.match(creation,/Copy prompt/)
  assert.doesNotMatch(creation,/Try prompt/)
  assert.deepEqual(STUDIO_INSPIRATIONS.map(study=>study.title),['Paper Star Map','Sunlit Pear Ad','Horse at Dawn','Cliffside Courier','The Prophetic Canvas','City Wakes Up','Buried Observatory','Rain Station Melody'])
  assert.deepEqual(STUDIO_INSPIRATIONS.map(study=>study.file),['paper-star-map','sunlit-pear-ad','horse-at-dawn','cliffside-courier','the-prophetic-canvas','city-wakes-up','buried-observatory','rain-station-melody'])
  assert.ok(STUDIO_INSPIRATIONS.every(study => !('credit' in study)))
  assert.doesNotMatch(creation,/Still:|study\.credit/)
  assert.ok(creation.indexOf('studio-board-mode') < creation.indexOf('studio-prompt-editor'))
  assert.ok(creation.indexOf('studio-prompt-editor') < creation.indexOf('studio-model-selector'))
  assert.ok(creation.indexOf('studio-model-selector') < creation.indexOf('studio-generate'))
  assert.ok(creation.indexOf('studio-generate') < creation.indexOf('studio-advanced-settings'))
  assert.ok(creation.indexOf('studio-advanced-settings') < creation.indexOf('studio-style-settings'))
})

test('active artwork paths respect the configured application mount', () => {
  for(const file of ['app/pages/index.vue','app/pages/studio.vue','app/components/AppHeader.vue','app/components/SiteFooter.vue','app/components/WorkspaceSidebar.vue']){
    assert.doesNotMatch(source(file),/["'`](?:\/brand\/|\/media\/)/,file)
  }
  const config=source('nuxt.config.ts')
  assert.match(config,/baseURL = process\.env\.NUXT_APP_BASE_URL/)
  assert.match(config,/cdnURL: baseURL/)
  assert.match(config,/buildAssetsDir: '_nuxt\/'/)
  assert.doesNotMatch(config,/check-fifteen\.css|check-twenty-two-tail\.css/)
})
