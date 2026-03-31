class Td < Formula
  desc "CLI for managing your todos — fast task management from the terminal"
  homepage "https://github.com/karthikg80/todos-api"
  url "https://registry.npmjs.org/@karthikg80/td/-/td-1.0.0.tgz"
  sha256 "REPLACE_AFTER_FIRST_PUBLISH"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "CLI for managing your todos", shell_output("#{bin}/td --help")
  end
end
