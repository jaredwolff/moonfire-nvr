// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2024 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow, { TableRowProps } from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { useEffect, useState } from "react";
import * as api from "../api";
import { FrameProps } from "../App";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import IconButton from "@mui/material/IconButton";
import DeleteDialog from "./DeleteDialog";
import AddEditDialog from "./AddEditDialog";

import React from "react";
import { CameraManagement, Camera } from "../types";

interface Props {
  Frame: (props: FrameProps) => JSX.Element;
  csrf?: string;
}

interface RowProps extends TableRowProps {
  cameraName: React.ReactNode;
  description: React.ReactNode;
  streams: React.ReactNode;
  status: React.ReactNode;
  gutter?: React.ReactNode;
}

/// More menu attached to a particular camera row.
interface More {
  camera: CameraManagement;
  anchor: HTMLElement;
}

const Row = ({
  cameraName,
  description,
  streams,
  status,
  gutter,
  ...rest
}: RowProps) => (
  <TableRow {...rest}>
    <TableCell>{cameraName}</TableCell>
    <TableCell>{description}</TableCell>
    <TableCell>{streams}</TableCell>
    <TableCell>{status}</TableCell>
    <TableCell>{gutter}</TableCell>
  </TableRow>
);

const StreamChips = ({ streams }: { streams: any }) => (
  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
    {Object.entries(streams || {}).map(
      ([streamType, stream]: [string, any]) => {
        if (!stream) return null;

        const isRecording = stream.record || false;
        const isConfigured = stream.config?.url;

        return (
          <Chip
            key={streamType}
            label={streamType}
            size="small"
            color={
              isRecording ? "success" : isConfigured ? "primary" : "default"
            }
            variant={
              isRecording ? "filled" : isConfigured ? "filled" : "outlined"
            }
            sx={
              isConfigured && !isRecording
                ? {
                    backgroundColor: "rgba(25, 118, 210, 0.8)",
                    color: "white",
                    "&:hover": {
                      backgroundColor: "rgba(25, 118, 210, 0.9)",
                    },
                  }
                : undefined
            }
          />
        );
      }
    )}
  </div>
);

const Main = ({ Frame, csrf }: Props) => {
  const [cameras, setCameras] = useState<
    api.FetchResult<api.CamerasResponse> | undefined
  >();
  const [more, setMore] = useState<undefined | More>();
  const [fetchSeq, setFetchSeq] = useState(0);
  const [cameraToEdit, setCameraToEdit] = useState<
    undefined | null | CameraManagement
  >();
  const [deleteCamera, setDeleteCamera] = useState<
    undefined | CameraManagement
  >();

  const refetch = () => setFetchSeq((s) => s + 1);

  useEffect(() => {
    const abort = new AbortController();
    const doFetch = async (signal: AbortSignal) => {
      setCameras(await api.cameras({ signal }));
    };
    doFetch(abort.signal);
    return () => {
      abort.abort();
    };
  }, [fetchSeq]);

  const convertCameraToManagement = (c: api.CameraWithId): CameraManagement => {
    return {
      id: c.id,
      uuid: c.uuid,
      shortName: c.camera.shortName,
      description: c.camera.description,
      onvifBaseUrl: (c.camera as any).config?.onvifBaseUrl,
      username: (c.camera as any).config?.username,
      password: (c.camera as any).config?.password,
      streams: Object.entries(c.camera.streams || {}).map(
        ([_, stream]: [string, any]) => ({
          url: stream?.config?.url,
          record: stream?.record || false,
          flushIfSec: stream?.config?.flushIfSec || 120,
          rtspTransport: stream?.config?.rtspTransport || "tcp",
          sampleFileDirId: stream?.sampleFileDirId,
        })
      ),
    };
  };

  const renderCameraStatus = (camera: Camera) => {
    const streams = camera.streams || {};
    const hasRecordingStreams = Object.values(streams).some(
      (stream: any) => stream?.record
    );
    const hasStreams = Object.values(streams).some((stream: any) => stream);

    if (!hasStreams) {
      return <Chip label="No Streams" size="small" color="error" />;
    }

    if (hasRecordingStreams) {
      return <Chip label="Recording" size="small" color="success" />;
    }

    return <Chip label="Live Only" size="small" color="info" />;
  };

  return (
    <Frame>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <Row
              cameraName="Camera"
              description="Description"
              streams="Streams"
              status="Status"
              gutter={
                <IconButton
                  aria-label="add"
                  onClick={() => setCameraToEdit(null)}
                >
                  <AddIcon />
                </IconButton>
              }
            />
          </TableHead>
          <TableBody>
            {cameras === undefined && (
              <Row
                role="progressbar"
                cameraName={<Skeleton />}
                description={<Skeleton />}
                streams={<Skeleton />}
                status={<Skeleton />}
              />
            )}
            {cameras?.status === "error" && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Alert severity="error">{cameras.message}</Alert>
                </TableCell>
              </TableRow>
            )}
            {cameras?.status === "success" &&
              cameras.response.cameras.map((c: api.CameraWithId) => (
                <Row
                  key={c.uuid}
                  cameraName={c.camera.shortName}
                  description={c.camera.description || <em>none</em>}
                  streams={<StreamChips streams={c.camera.streams} />}
                  status={renderCameraStatus(c.camera)}
                  gutter={
                    <IconButton
                      aria-label="more"
                      onClick={(e) =>
                        setMore({
                          camera: convertCameraToManagement(c),
                          anchor: e.currentTarget,
                        })
                      }
                    >
                      <MoreVertIcon />
                    </IconButton>
                  }
                />
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Menu
        anchorEl={more?.anchor}
        open={more !== undefined}
        onClose={() => setMore(undefined)}
      >
        <MenuItem
          onClick={() => {
            setCameraToEdit(more?.camera);
            setMore(undefined);
          }}
        >
          Edit
        </MenuItem>

        <MenuItem>
          <Typography
            color="error"
            onClick={() => {
              setDeleteCamera(more?.camera);
              setMore(undefined);
            }}
          >
            Delete
          </Typography>
        </MenuItem>
      </Menu>
      {cameraToEdit !== undefined && (
        <AddEditDialog
          prior={cameraToEdit}
          refetch={refetch}
          onClose={() => setCameraToEdit(undefined)}
          csrf={csrf}
        />
      )}
      <DeleteDialog
        cameraToDelete={deleteCamera}
        refetch={refetch}
        onClose={() => setDeleteCamera(undefined)}
        csrf={csrf}
      />
    </Frame>
  );
};

export default Main;
