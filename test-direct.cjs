fetch("https://statslc.leosaquetto.com/api/group")
  .then(r => r.text())
  .then(console.log)
  .catch(console.error);
