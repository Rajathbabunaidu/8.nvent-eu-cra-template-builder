export default {
  editor: { label: { en: 'EU CRA Hub — Template Builder' }, icon: 'layout' },
  properties: {
    supabaseUrl: {
      label: { en: 'Supabase Project URL' }, type: 'Text', section: 'settings', bindable: true, defaultValue: '',
      /* wwEditor:start */ propertyHelp: 'Public HTTPS project URL only. Do not include /rest/v1.' /* wwEditor:end */
    },
    publishableKey: {
      label: { en: 'Supabase Publishable Key' }, type: 'Text', section: 'settings', bindable: true, defaultValue: '',
      /* wwEditor:start */ propertyHelp: 'Enter only sb_publishable_… . Never use sb_secret_ or service_role keys.' /* wwEditor:end */
    },
    actorUserId: {
      label: { en: 'Actor user_profiles.id (development)' }, type: 'Number', section: 'settings', bindable: true, defaultValue: 0,
      /* wwEditor:start */ propertyHelp: 'Existing user_profiles numeric ID; not identity verification. Required for create/tool/validation/publish.' /* wwEditor:end */
    },
    initialTemplateVersionId: {
      label: { en: 'Initial Template Version ID' }, type: 'Number', section: 'settings', bindable: true, defaultValue: 0,
      /* wwEditor:start */ propertyHelp: 'Optional: preselect a template version. Otherwise the most recently updated version loads.' /* wwEditor:end */
    },
    enableMutations: {
      label: { en: 'Enable development writes (unsafe without Auth)' }, type: 'OnOff', section: 'settings', bindable: true, defaultValue: false,
      /* wwEditor:start */ propertyHelp: 'OFF by default. Only enable in an isolated development project with appropriate grants.' /* wwEditor:end */
    },
    enablePublication: {
      label: { en: 'Enable publication after validation (development only)' }, type: 'OnOff', section: 'settings', bindable: true, defaultValue: false,
      /* wwEditor:start */ propertyHelp: 'Publication also blocked when new domain-shared review stages exist: backend snapshot/validation integration is not finished.' /* wwEditor:end */
    },
    accentColor: { label: { en: 'Accent color' }, type: 'Color', section: 'style', bindable: true, defaultValue: '#c4262e' },
  },
  triggerEvents: [
    {name:'template-selected',label:{en:'Template Selected'},event:{template_id:0,template_version_id:0}},
    {name:'draft-created',label:{en:'Draft Created'},event:{template_id:0,template_version_id:0}},
    {name:'draft-saved',label:{en:'Draft Saved'},event:{template_version_id:0,area:''}},
    {name:'validation-completed',label:{en:'Validation Completed'},event:{template_version_id:0,ready:false}},
    {name:'template-published',label:{en:'Template Published'},event:{template_version_id:0}},
  ]
};
