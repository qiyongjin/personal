import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ResumeDocument from "../shared/ResumeDocument";
import { resumeSchema } from "../shared/resume";

const legacy = {
  basics: {
    name: "Example", headline: "", city: "", jobType: "Full-time",
    salary: "", phone: "", email: "11aaa@gmail.com",
  },
  sections: [],
};

test("existing resumes still render without custom contact fields", () => {
  const data = resumeSchema.parse(legacy);
  assert.deepEqual(data.basics.contacts, []);
  const html = renderToStaticMarkup(<ResumeDocument data={data} locale="en" />);
  assert.ok(html.includes("Full-time | Email: 11aaa@gmail.com"));
});

test("custom labels, unlabeled values and ordering render in both languages", () => {
  const data = resumeSchema.parse({
    ...legacy,
    basics: { ...legacy.basics, contacts: [
      { id: "website", label: " Website ", value: " example.com " },
      { id: "remote", label: "", value: "Remote" },
      { id: "empty", label: "Empty", value: "   " },
    ] },
  });
  const en = renderToStaticMarkup(<ResumeDocument data={data} locale="en" />);
  assert.ok(en.includes("Email: 11aaa@gmail.com | Website: example.com | Remote"));
  assert.ok(!en.includes("Empty:"));
  const zh = renderToStaticMarkup(<ResumeDocument data={data} locale="zh" />);
  assert.ok(zh.includes("Website：example.com | Remote"));
});

test("custom content is escaped instead of interpreted as HTML", () => {
  const data = resumeSchema.parse({
    ...legacy,
    basics: { ...legacy.basics, contacts: [
      { id: "literal", label: "Custom", value: "<script>alert(1)</script>" },
    ] },
  });
  const html = renderToStaticMarkup(<ResumeDocument data={data} locale="en" />);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("custom entries respect size and unique ID limits", () => {
  const parse = (contacts: unknown[]) => resumeSchema.safeParse({
    ...legacy, basics: { ...legacy.basics, contacts },
  });
  assert.equal(parse(Array.from({ length: 21 }, (_, i) => ({
    id: `contact-${i}`, label: "", value: "test",
  }))).success, false);
  assert.equal(parse([{ id: "long", label: "", value: "a".repeat(1001) }]).success, false);
  assert.equal(parse([
    { id: "duplicate", label: "", value: "first" },
    { id: "duplicate", label: "", value: "second" },
  ]).success, false);
});
