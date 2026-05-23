async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/group");
    console.log("Status:", res.status);
    console.log("Text:", await res.text());
  } catch(e) {
    console.log("Error:", e);
  }
}
test();
