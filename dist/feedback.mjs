try {
 const response=await fetch('./site-config.json');
 const {repository}=await response.json();
 if (/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(repository)) document.querySelector('#feedbackLink').href='https://github.com/'+repository+'/issues/new?template=feedback.yml';
} catch { /* Keep the direct default link. */ }
