import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { LinkButton } from '../lib/link-button'
import { PathText } from '../lib/path-text'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { ICommitContext } from '../../models/commit'
import { DefaultCommitMessage } from '../../models/commit-message'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { stat } from 'fs/promises'
import { join } from 'path'
import { formatBytes } from '../lib/bytes'

const GitLFSWebsiteURL =
  'https://help.github.com/articles/versioning-large-files/'

interface IOversizedFilesProps {
  readonly oversizedFiles: ReadonlyArray<string>
  readonly onDismissed: () => void
  readonly dispatcher: Dispatcher
  readonly context: ICommitContext
  readonly repository: Repository
}

interface IOversizedFilesState {
  readonly fileSizes: ReadonlyMap<string, number>
}

/** A dialog to display a list of files that are too large to commit. */
export class OversizedFiles extends React.Component<
  IOversizedFilesProps,
  IOversizedFilesState
> {
  private fileSizeRequest = 0

  public constructor(props: IOversizedFilesProps) {
    super(props)

    this.state = { fileSizes: new Map() }
  }

  public componentDidMount() {
    void this.loadFileSizes()
  }

  public componentDidUpdate(prevProps: IOversizedFilesProps) {
    if (
      prevProps.repository.path !== this.props.repository.path ||
      prevProps.oversizedFiles !== this.props.oversizedFiles
    ) {
      void this.loadFileSizes()
    }
  }

  public render() {
    return (
      <Dialog
        id="oversized-files"
        title={__DARWIN__ ? 'Files Too Large' : 'Files too large'}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
        type="warning"
      >
        <DialogContent>
          <p>
            The following files are over 100MB.{' '}
            <strong>
              If you commit these files, you will no longer be able to push this
              repository to GitHub.com.
            </strong>
          </p>
          {this.renderFileList()}
          <p className="recommendation">
            We recommend you avoid committing these files or use{' '}
            <LinkButton uri={GitLFSWebsiteURL}>Git LFS</LinkButton> to store
            large files on GitHub.
          </p>
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={__DARWIN__ ? 'Commit Anyway' : 'Commit anyway'}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderFileList() {
    return (
      <div className="files-list">
        <ul>
          {this.props.oversizedFiles.map(fileName => (
            <li key={fileName}>
              <PathText path={fileName} />
              {this.renderFileSize(fileName)}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  private renderFileSize(fileName: string) {
    const fileSize = this.state.fileSizes.get(fileName)
    return fileSize === undefined ? null : (
      <span className="file-size"> ({formatBytes(fileSize, 2)})</span>
    )
  }

  private async loadFileSizes() {
    const request = ++this.fileSizeRequest
    const entries = await Promise.all(
      this.props.oversizedFiles.map(async fileName => {
        try {
          const fileStats = await stat(
            join(this.props.repository.path, fileName)
          )
          return [fileName, fileStats.size] as const
        } catch (error) {
          log.debug(`Unable to get the file size for ${fileName}`, error)
          return null
        }
      })
    )

    if (request === this.fileSizeRequest) {
      this.setState({
        fileSizes: new Map(
          entries.filter(
            (entry): entry is readonly [string, number] => entry !== null
          )
        ),
      })
    }
  }

  private onSubmit = async () => {
    this.props.onDismissed()

    await this.props.dispatcher.commitIncludedChanges(
      this.props.repository,
      this.props.context
    )

    this.props.dispatcher.setCommitMessage(
      this.props.repository,
      DefaultCommitMessage
    )
  }
}
