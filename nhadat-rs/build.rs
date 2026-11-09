// Computes ASSET_V: short content hash of static css/js, used as ?v= cache-buster in templates.
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::{fs, path::Path};

fn collect(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                collect(&p, out);
            } else {
                out.push(p);
            }
        }
    }
}

fn main() {
    println!("cargo:rerun-if-changed=static/css");
    println!("cargo:rerun-if-changed=static/js");
    let mut files = Vec::new();
    collect(Path::new("static/css"), &mut files);
    collect(Path::new("static/js"), &mut files);
    files.sort();
    let mut h = DefaultHasher::new();
    env!("CARGO_PKG_VERSION").hash(&mut h);
    for f in &files {
        f.hash(&mut h);
        fs::read(f).unwrap_or_default().hash(&mut h);
    }
    println!("cargo:rustc-env=ASSET_V={:08x}", h.finish() as u32);
}
