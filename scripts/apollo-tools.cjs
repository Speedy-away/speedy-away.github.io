const image='/assets/images/consoles/apollo-save-tool.png';
const tools={
 ps4:{name:'PS4',repo:'apollo-ps4',description:'Manage, export, import, patch and resign PS4 saves directly on your homebrew-enabled console.'},
 ps3:{name:'PS3',repo:'apollo-ps3',description:'Back up, manage, patch and resign PS3 saves, with trophy and virtual-memory-card tools.'},
 vita:{name:'PS Vita',repo:'apollo-vita',description:'Manage PS Vita, PSP/Adrenaline and PS1 saves, with import, export, patches and resigning tools.'}
};
function section(platform){
 const tool=tools[platform];if(!tool)throw Error('Unknown Apollo platform');
 const repo='https://github.com/bucanero/'+tool.repo;
 return `<!-- BEGIN APOLLO ${platform.toUpperCase()} -->
<section class="section" id="save-tools"><div class="container"><div class="section-header"><h2 class="section-title">Save tools</h2></div><div class="games-grid"><article class="guide-resource" data-search="apollo save tool ${tool.name.toLowerCase()} backup restore patch resign"><img src="${image}" alt="Apollo Save Tool interface" loading="lazy"><h3>Apollo Save Tool · ${tool.name}</h3><p>${tool.description}</p><div class="guide-links"><a href="${repo}/releases" class="btn btn-primary" target="_blank" rel="noopener noreferrer"><i class="fas fa-download" aria-hidden="true"></i> Download for ${tool.name}</a><a href="${repo}" target="_blank" rel="noopener noreferrer">Project <i class="fas fa-external-link-alt" aria-hidden="true"></i></a></div></article></div></div></section>
<!-- END APOLLO ${platform.toUpperCase()} -->`;
}
module.exports={tools,image,section};
