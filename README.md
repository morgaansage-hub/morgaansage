# Portfolio

A Swiss-grid × pixel-tech portfolio for GitHub Pages. Plain HTML/CSS/JS, so there's no build step.

## Files
```
index.html               ← home: hero, work grid, about, contact
projects/case-study.html ← template: duplicate once per project
css/style.css            ← all styles (colors at the top under :root)
js/main.js               ← animated pixel grid, project filters
assets/                  ← put your images + resume.pdf here
```

## Put it online (GitHub Pages)
1. Create a repo named **`yourusername.github.io`** (gives you that URL), or any name (URL becomes `yourusername.github.io/reponame`).
2. Upload these files to the repo root (drag‑and‑drop on github.com works, via "Add file → Upload files").
3. Go to **Settings → Pages → Source: Deploy from a branch → `main` / root → Save**.
4. Wait ~1 minute, then visit your URL.

## Customize
- **Name/text:** search `Your Name`, `yourname`, `you@email.com` and replace them.
- **Colors:** edit `--blue`, `--blue-soft`, `--lime` at the top of `css/style.css`.
- **Pixel grid look:** change `CELL` (square size) and `THRESHOLD` (density) at the top of `js/main.js`.
- **Add a project:** copy a `<li class="card">` block in `index.html`. Set `data-cat` to `ux`, `games`, or `graphic`.
- **Swap a placeholder image:** replace `<div class="ph ph--dither"></div>` (any `ph--…`)
  with `<img src="assets/my-image.jpg" alt="Describe the image">`. The "your image here" sticker goes away on its own.
- **Your photo:** same swap inside the About section.
- **Resume:** add `assets/resume.pdf`.
- **Games:** embed itch.io widgets or YouTube trailers in the case study (see the comment in the template). Unity WebGL builds can also go in a folder in this repo.

Tip: export images as `.jpg`/`.webp` around 1600px wide so the site stays fast.
