# Document Contribution

Contributions to the PyPTO documentation are welcome. Approved documents will be published on the [PyPTO Toolkit Documentation Center](https://pypto-tools.gitcode.com).

This project supports content contributions in Markdown format. You can create documents with the `.md` extension or modify existing documents.

## Update/Add Documents

For document writing requirements, refer to the [Document Writing Specifications](https://gitcode.com/cann/community/blob/master/contributor/docs/document_writing_specs.md).

### Update Documents

If you need to update existing documentation, click the edit button in the upper right corner of the [PyPTO Toolkit Documentation Center](https://pypto-tools.gitcode.com/) page to navigate to the source file. Modify the file and submit a PR to participate in the contribution.

### Add Documents

To add a new document, create a Markdown file in the appropriate directory under `docs/zh/`.

Then, add the new file to the `toctree` in `docs/zh/index.md` or the `index.md` of its chapter.

After completing the above operations, submit a PR to contribute.

## Local Build

After submitting a PR, you can use Sphinx to generate the documentation locally. For details, refer to [Documentation Build](./README_en.md#documentation-build).

## Remote Build

After a PR is merged, the website content is updated automatically. You will see the new content on the [PyPTO Toolkit Documentation Center](https://pypto-tools.gitcode.com).
