let ioInstance = null;

export const setSocket = (io) => {
  ioInstance = io;
};

export const getSocket = () => ioInstance;
