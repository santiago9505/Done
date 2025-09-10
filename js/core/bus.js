let handlers = {
  renderHome: ()=>{},
  renderBoard: ()=>{},
  renderTasksList: ()=>{},
};
export function setRefreshers(obj){ handlers = {...handlers, ...obj}; }
export const refresh = {
  home: ()=>handlers.renderHome?.(),
  board: ()=>handlers.renderBoard?.(),
  tasks: ()=>handlers.renderTasksList?.(),
};

