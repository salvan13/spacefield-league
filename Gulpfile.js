const gulp = require("gulp");
const minify = require("gulp-babel-minify");
const csso = require("gulp-csso");
const htmlmin = require("gulp-htmlmin");
const zip = require("gulp-zip");

gulp.task("js", () => {
  return gulp.src("src/*.js").pipe(minify()).pipe(gulp.dest("public"));
});

gulp.task("css", () => {
  return gulp.src("src/*.css").pipe(csso()).pipe(gulp.dest("public"));
});

gulp.task("html", () => {
  return gulp.src("src/*.html").pipe(htmlmin({collapseWhitespace: true})).pipe(gulp.dest("public"));
});

gulp.task("copy", () => {
  return gulp.src("src/*.woff2").pipe(gulp.dest("public"));
});

gulp.task("zip", ["html", "js", "css", "copy"], () => {
  return gulp.src("public/**").pipe(zip("entry.zip")).pipe(gulp.dest("dist"));
});

gulp.task("default", ["zip"]);
