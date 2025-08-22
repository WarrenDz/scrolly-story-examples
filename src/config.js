function generateScriptConfig() {
  window.storyMapsEmbedConfig = {
      storyId: "2c5879f192a648049d032412b1b2701c",
      rootNode: ".storymaps-root",
  };
}

function createScriptedEmbed() {
  const script = document.createElement('script');
  script.id = 'embed-script';
  script.src = `https://storymaps.arcgis.com/embed/view`;
  document.body.appendChild(script);
}

generateScriptConfig();
createScriptedEmbed();