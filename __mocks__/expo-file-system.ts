export class File {
  uri: string;
  constructor(public parent: any, public name: string) {
    this.uri = `file:///mock/cache/${name}`;
  }
  static async downloadFileAsync(url: string, destination: any): Promise<File> {
    return new File(destination, 'mock_image.jpg');
  }
  async delete(): Promise<void> {}
}

export class Paths {
  static get cache() {
    return { uri: 'file:///mock/cache' };
  }
  static get document() {
    return { uri: 'file:///mock/document' };
  }
}
